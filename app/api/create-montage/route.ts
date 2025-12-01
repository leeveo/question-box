import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import axios from 'axios';

const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;
const SHOTSTACK_ENV = process.env.SHOTSTACK_ENV || 'sandbox'; // sandbox ou v1 (prod)

interface ClipTiming {
    videoId: string;
    startTime: number;
    endTime: number;
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    },
                },
            }
        );
        
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const { projectId, projectName, clips, mp4Urls } = body as {
            projectId: string;
            projectName: string;
            clips: ClipTiming[];
            mp4Urls?: Record<string, string>;
        };

        if (!projectId || !clips || clips.length === 0) {
            return NextResponse.json(
                { error: 'Données manquantes' },
                { status: 400 }
            );
        }

        // 1. Utiliser les URLs MP4 passées en paramètre (déjà converties)
        const videoUrlsMap = new Map<string, string>();
        
        if (mp4Urls) {
            // Utiliser les URLs MP4 converties
            for (const [videoId, mp4Url] of Object.entries(mp4Urls)) {
                videoUrlsMap.set(videoId, mp4Url);
            }
            console.log('URLs MP4 converties:', Array.from(videoUrlsMap.entries()));
        } else {
            // Fallback: récupérer depuis la base de données
            const { data: videos, error: videosError } = await supabase
                .from('videos')
                .select('id, s3_url')
                .in('id', clips.map(c => c.videoId));

            if (videosError) throw videosError;

            console.log('Videos récupérées:', videos?.map(v => ({ id: v.id, url: v.s3_url })));

            for (const video of videos || []) {
                videoUrlsMap.set(video.id, video.s3_url);
            }
            console.log('URLs finales:', Array.from(videoUrlsMap.entries()));
        }

        // 2. Construire la timeline Shotstack
        let currentTime = 0;
        const videoClips = clips.map((clip) => {
            // Utiliser l'URL MP4 convertie
            const videoUrl = videoUrlsMap.get(clip.videoId);
            if (!videoUrl) throw new Error(`Video ${clip.videoId} not found`);

            const clipLength = clip.endTime - clip.startTime;
            
            console.log(`Clip ${clip.videoId}:`, {
                url: videoUrl,
                startTime: clip.startTime,
                endTime: clip.endTime,
                length: clipLength,
                position: currentTime
            });

            // Construction de l'asset vidéo
            const asset: any = {
                type: 'video' as const,
                src: videoUrl,
            };

            // IMPORTANT: trim indique OÙ commencer dans la vidéo SOURCE
            // Si startTime = 12 et endTime = 24, on veut extraire de 12s à 24s de la vidéo
            // Donc trim = startTime (commence à cette seconde dans la source)
            if (clip.startTime > 0) {
                asset.trim = clip.startTime;
            }

            const clipData: any = {
                asset,
                start: currentTime, // Position dans la timeline finale
                length: clipLength, // Durée à extraire depuis le point trim
            };

            currentTime += clipLength;
            return clipData;
        });

        const timeline = {
            tracks: [
                {
                    clips: videoClips,
                },
            ],
        };

        const output = {
            format: 'mp4' as const,
            resolution: 'hd' as const,
            fps: 25,
            quality: 'medium' as const,
        };

        console.log('Timeline complète:', JSON.stringify(timeline, null, 2));
        console.log('Envoi de la requête à Shotstack...', {
            clipsCount: videoClips.length,
            totalDuration: currentTime,
            videosUrls: videoClips.map(c => c.asset.src)
        });

        // 3. Envoyer la requête à Shotstack
        const shotstackResponse = await axios.post(
            `https://api.shotstack.io/stage/render`,
            {
                timeline,
                output,
            },
            {
                headers: {
                    'x-api-key': SHOTSTACK_API_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );

        const renderId = shotstackResponse.data.response.id;
        console.log('Shotstack render ID:', renderId);

        // 4. Créer l'enregistrement dans la base de données
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const montageName = `${projectName}_montage_${timestamp}_master-final`;

        const { data: montage, error: montageError } = await supabase
            .from('video_montages')
            .insert({
                project_id: projectId,
                user_id: user.id,
                name: montageName,
                s3_url: '', // Sera mis à jour quand le rendu sera terminé
                video_count: clips.length,
                status: 'processing',
                duration: Math.round(currentTime),
            })
            .select()
            .single();

        if (montageError) throw montageError;

        // 5. Créer les clips
        const clipRecords = clips.map((clip, index) => ({
            montage_id: montage.id,
            video_id: clip.videoId,
            clip_order: index,
            start_time: clip.startTime,
            end_time: clip.endTime,
        }));

        const { error: clipsError } = await supabase
            .from('video_montage_clips')
            .insert(clipRecords);

        if (clipsError) throw clipsError;

        // 6. Démarrer le polling pour vérifier le statut (en arrière-plan)
        pollShotstackStatus(renderId, montage.id);

        return NextResponse.json({
            success: true,
            montage: {
                id: montage.id,
                name: montageName,
                status: 'processing',
                renderId,
                message: `Le montage est en cours de création avec Shotstack. Le rendu prendra environ ${Math.ceil(currentTime / 60)} minute(s). Rafraîchissez la page des montages pour voir le résultat.`,
            },
        });

    } catch (error) {
        console.error('Error creating montage:', error);
        
        if (axios.isAxiosError(error)) {
            console.error('Shotstack API error:', error.response?.data);
            return NextResponse.json(
                { 
                    error: 'Erreur Shotstack API', 
                    details: error.response?.data?.response?.message || error.message 
                },
                { status: 500 }
            );
        }
        
        return NextResponse.json(
            { error: 'Erreur lors de la création du montage' },
            { status: 500 }
        );
    }
}

// Fonction pour vérifier le statut du rendu Shotstack
async function pollShotstackStatus(renderId: string, montageId: string) {
    const maxAttempts = 120; // 10 minutes max (toutes les 5 secondes)
    let attempts = 0;

    const checkStatus = async () => {
        try {
            const statusResponse = await axios.get(
                `https://api.shotstack.io/stage/render/${renderId}`,
                {
                    headers: { 'x-api-key': SHOTSTACK_API_KEY },
                }
            );

            const status = statusResponse.data.response.status;
            const url = statusResponse.data.response.url;
            const error = statusResponse.data.response.error;
            const data = statusResponse.data.response.data;

            console.log(`Shotstack status for ${renderId}: ${status}`);
            
            if (error) {
                console.error(`Shotstack error for ${renderId}:`, error);
            }
            
            if (data && data.errors) {
                console.error(`Shotstack data errors for ${renderId}:`, data.errors);
            }

            if (status === 'done' && url) {
                // Le rendu est terminé, mise à jour en base de données
                const supabase = createServerClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    {
                        cookies: {
                            getAll() { return []; },
                            setAll() { },
                        },
                    }
                );

                const { error: updateError } = await supabase
                    .from('video_montages')
                    .update({
                        s3_url: url,
                        status: 'completed',
                    })
                    .eq('id', montageId);

                if (updateError) {
                    console.error(`Error updating montage ${montageId}:`, updateError);
                } else {
                    console.log(`Montage ${montageId} terminé: ${url}`);
                }
                return; // Arrêter le polling
            } else if (status === 'failed') {
                // Le rendu a échoué
                const supabase = createServerClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    {
                        cookies: {
                            getAll() { return []; },
                            setAll() { },
                        },
                    }
                );

                const { error: updateError } = await supabase
                    .from('video_montages')
                    .update({ status: 'failed' })
                    .eq('id', montageId);

                if (updateError) {
                    console.error(`Error updating failed montage ${montageId}:`, updateError);
                }
                console.error(`Montage ${montageId} échoué:`, error);
                return; // Arrêter le polling
            }

            // Statut en cours (queued, fetching, rendering)
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(checkStatus, 5000); // Vérifier toutes les 5 secondes
            } else {
                console.warn(`Timeout pour le montage ${montageId} après ${maxAttempts} tentatives`);
            }
        } catch (error) {
            console.error('Error polling Shotstack:', error);
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(checkStatus, 5000);
            }
        }
    };

    // Démarrer le polling
    checkStatus();
}
