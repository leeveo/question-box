import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!;

/**
 * API pour convertir une vidéo WebM en MP4 via Shotstack
 * Retourne l'URL MP4 convertie
 */
export async function POST(request: NextRequest) {
    try {
        const { webmUrl, videoId, duration } = await request.json();

        if (!webmUrl) {
            return NextResponse.json({ error: 'URL vidéo manquante' }, { status: 400 });
        }

        console.log(`Conversion de ${videoId || 'vidéo'}: ${webmUrl}, durée: ${duration}s`);

        // Créer un rendu simple pour convertir la vidéo
        const timeline = {
            tracks: [
                {
                    clips: [
                        {
                            asset: {
                                type: 'video',
                                src: webmUrl,
                            },
                            start: 0,
                            length: duration || undefined, // Utiliser la durée fournie ou laisser Shotstack la détecter
                        },
                    ],
                },
            ],
        };

        const output = {
            format: 'mp4',
            resolution: 'hd',
            fps: 25,
            quality: 'medium',
        };

        const response = await axios.post(
            'https://api.shotstack.io/stage/render',
            { timeline, output },
            {
                headers: {
                    'x-api-key': SHOTSTACK_API_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );

        const renderId = response.data.response.id;
        console.log(`Conversion lancée pour ${videoId || 'vidéo'}, render ID: ${renderId}`);

        // Attendre que la conversion soit terminée (polling)
        const mp4Url = await pollConversionStatus(renderId, videoId);

        return NextResponse.json({
            success: true,
            mp4Url,
            originalUrl: webmUrl,
            videoId,
        });
    } catch (error) {
        console.error('Error converting video:', error);
        if (axios.isAxiosError(error)) {
            console.error('Shotstack error:', error.response?.data);
        }
        return NextResponse.json(
            { error: 'Erreur lors de la conversion', details: error instanceof Error ? error.message : 'Erreur inconnue' },
            { status: 500 }
        );
    }
}

async function pollConversionStatus(renderId: string, videoId?: string): Promise<string> {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const statusResponse = await axios.get(
                `https://api.shotstack.io/stage/render/${renderId}`,
                {
                    headers: { 'x-api-key': SHOTSTACK_API_KEY },
                }
            );

            const status = statusResponse.data.response.status;
            const url = statusResponse.data.response.url;

            console.log(`Conversion ${videoId || renderId}: ${status}`);

            if (status === 'done' && url) {
                console.log(`Conversion terminée: ${url}`);
                return url;
            } else if (status === 'failed') {
                const error = statusResponse.data.response.error;
                throw new Error(`Conversion échouée: ${error}`);
            }

            // Attendre 5 secondes avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        } catch (error) {
            console.error('Error polling conversion:', error);
            throw error;
        }
    }

    throw new Error('Timeout: La conversion a pris trop de temps');
}
