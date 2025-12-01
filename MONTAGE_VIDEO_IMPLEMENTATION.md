# Implémentation du Montage Vidéo Automatique

## ✅ Ce qui est déjà fait

1. **Base de données** ✓
   - Table `video_montages` pour stocker les montages finaux
   - Table `video_montage_clips` pour les détails des clips
   - Politiques RLS configurées

2. **Interface utilisateur** ✓
   - Page de sélection de vidéos avec checkboxes
   - Modal de configuration des timings (début/fin pour chaque clip)
   - Page "Montages Vidéo" dans la sidebar
   - Filtrage par projet
   - Statistiques des montages

3. **API de création** ✓
   - Route `/api/create-montage`
   - Enregistrement dans la base de données
   - Structure prête pour le traitement

## 🎯 Solutions PRODUCTION READY (Sans FFmpeg local)

### ⭐ Option 1 : **Shotstack API** (RECOMMANDÉE)

**Pourquoi ?**
- ✅ Gratuit jusqu'à 20 renders/mois (sandbox)
- ✅ API simple et puissante
- ✅ Supporte découpage précis au centième de seconde
- ✅ Exports HD/4K
- ✅ Webhook pour notifications
- ✅ Pas besoin de serveur

**Prix:** 
- Sandbox: GRATUIT (watermark)
- Production: 9$/mois pour 100 vidéos

**Installation:**
```bash
npm install axios
```

**Implémentation complète:**

```typescript
// app/api/create-montage/route.ts
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
        const { projectId, projectName, clips } = body as {
            projectId: string;
            projectName: string;
            clips: ClipTiming[];
        };

        if (!projectId || !clips || clips.length === 0) {
            return NextResponse.json(
                { error: 'Données manquantes' },
                { status: 400 }
            );
        }

        // 1. Récupérer les URLs S3 des vidéos
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('id, s3_url')
            .in('id', clips.map(c => c.videoId));

        if (videosError) throw videosError;

        // 2. Construire la timeline Shotstack
        let currentTime = 0;
        const videoClips = clips.map((clip) => {
            const video = videos?.find(v => v.id === clip.videoId);
            if (!video) throw new Error(`Video ${clip.videoId} not found`);

            const clipData = {
                asset: {
                    type: 'video',
                    src: video.s3_url,
                    trim: clip.startTime, // Début du clip
                },
                start: currentTime,
                length: clip.endTime - clip.startTime, // Durée du clip
                fit: 'crop',
                scale: 1,
            };

            currentTime += clip.endTime - clip.startTime;
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
            format: 'mp4',
            resolution: 'hd', // 'sd', 'hd', '1080', '4k'
            fps: 25,
            quality: 'medium', // 'low', 'medium', 'high'
        };

        // 3. Envoyer la requête à Shotstack
        const shotstackResponse = await axios.post(
            `https://api.shotstack.io/${SHOTSTACK_ENV}/render`,
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

        // 4. Créer l'enregistrement dans la base de données
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const montageName = `${projectName}_montage_${timestamp}_master-final`;

        const { data: montage, error: montageError } = await supabase
            .from('video_montages')
            .insert({
                project_id: projectId,
                user_id: user.id,
                name: montageName,
                s3_url: '', // Sera mis à jour via webhook
                video_count: clips.length,
                status: 'processing',
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

        // 6. Démarrer le polling pour vérifier le statut
        // (Ou utiliser un webhook - voir plus bas)
        const pollStatus = async () => {
            let attempts = 0;
            const maxAttempts = 60; // 5 minutes max

            const checkStatus = async () => {
                try {
                    const statusResponse = await axios.get(
                        `https://api.shotstack.io/${SHOTSTACK_ENV}/render/${renderId}`,
                        {
                            headers: { 'x-api-key': SHOTSTACK_API_KEY },
                        }
                    );

                    const status = statusResponse.data.response.status;
                    const url = statusResponse.data.response.url;

                    if (status === 'done' && url) {
                        // Mise à jour en base de données
                        await supabase
                            .from('video_montages')
                            .update({
                                s3_url: url,
                                status: 'completed',
                            })
                            .eq('id', montage.id);

                        return true;
                    } else if (status === 'failed') {
                        await supabase
                            .from('video_montages')
                            .update({ status: 'failed' })
                            .eq('id', montage.id);

                        return true;
                    }

                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkStatus, 5000); // Vérifier toutes les 5 secondes
                    }
                } catch (error) {
                    console.error('Error polling Shotstack:', error);
                }
            };

            // Démarrer le polling en arrière-plan
            checkStatus();
        };

        // Lancer le polling (non-bloquant)
        pollStatus();

        return NextResponse.json({
            success: true,
            montage: {
                id: montage.id,
                name: montageName,
                status: 'processing',
                renderId,
                message: 'Le montage est en cours de création avec Shotstack. Rafraîchissez la page dans quelques minutes.',
            },
        });

    } catch (error) {
        console.error('Error creating montage:', error);
        return NextResponse.json(
            { error: 'Erreur lors de la création du montage' },
            { status: 500 }
        );
    }
}
```

**Variables d'environnement:**
```env
# .env.local
SHOTSTACK_API_KEY=your_shotstack_api_key
SHOTSTACK_ENV=sandbox  # ou 'v1' pour production
```

**Obtenir la clé API:**
1. Créer un compte sur https://shotstack.io
2. Aller dans Dashboard → API Keys
3. Copier la clé (sandbox gratuite)

---

### ⭐ Option 2 : **Cloudinary API** 

**Pourquoi ?**
- ✅ Gratuit jusqu'à 25 crédits/mois
- ✅ Très populaire et fiable
- ✅ CDN intégré
- ✅ Transformations vidéo puissantes

**Installation:**
```bash
npm install cloudinary
```

**Implémentation:**

```typescript
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function createMontageWithCloudinary(clips: ClipTiming[]) {
    // 1. Upload les vidéos sur Cloudinary si nécessaire
    // 2. Créer les transformations pour chaque clip
    const transformedClips = clips.map((clip, index) => ({
        public_id: `clip_${index}`,
        transformation: [
            {
                start_offset: clip.startTime,
                end_offset: clip.endTime,
                quality: 'auto',
                fetch_format: 'mp4',
            },
        ],
    }));

    // 3. Concaténer avec Cloudinary
    const result = await cloudinary.uploader.create_archive({
        resource_type: 'video',
        public_ids: transformedClips.map(c => c.public_id),
        target_format: 'mp4',
        mode: 'create',
    });

    return result.secure_url;
}
```

---

### ⭐ Option 3 : **AWS MediaConvert**

**Pourquoi ?**
- ✅ Très puissant et scalable
- ✅ Intégré avec S3
- ✅ Pay-per-use (environ $0.015/minute)
- ✅ Idéal si vous utilisez déjà AWS

**Installation:**
```bash
npm install @aws-sdk/client-mediaconvert
```

**Implémentation:**

```typescript
import { MediaConvertClient, CreateJobCommand } from '@aws-sdk/client-mediaconvert';

const mediaConvertClient = new MediaConvertClient({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

async function createMontageWithMediaConvert(clips: ClipTiming[]) {
    const inputs = clips.map(clip => ({
        FileInput: clip.s3Url,
        TimecodeSource: 'ZEROBASED',
        InputClippings: [
            {
                StartTimecode: secondsToTimecode(clip.startTime),
                EndTimecode: secondsToTimecode(clip.endTime),
            },
        ],
    }));

    const command = new CreateJobCommand({
        Role: process.env.AWS_MEDIACONVERT_ROLE!,
        Settings: {
            Inputs: inputs,
            OutputGroups: [
                {
                    Name: 'File Group',
                    OutputGroupSettings: {
                        Type: 'FILE_GROUP_SETTINGS',
                        FileGroupSettings: {
                            Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/montages/`,
                        },
                    },
                    Outputs: [
                        {
                            VideoDescription: {
                                CodecSettings: {
                                    Codec: 'H_264',
                                    H264Settings: {
                                        MaxBitrate: 5000000,
                                        RateControlMode: 'QVBR',
                                    },
                                },
                            },
                            AudioDescriptions: [
                                {
                                    CodecSettings: {
                                        Codec: 'AAC',
                                        AacSettings: {
                                            Bitrate: 96000,
                                            CodingMode: 'CODING_MODE_2_0',
                                            SampleRate: 48000,
                                        },
                                    },
                                },
                            ],
                            ContainerSettings: {
                                Container: 'MP4',
                            },
                        },
                    ],
                },
            ],
        },
    });

    const response = await mediaConvertClient.send(command);
    return response.Job?.Id;
}

function secondsToTimecode(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 25); // 25 FPS
    
    return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames
        .toString()
        .padStart(2, '0')}`;
}
```

---

## 📊 Comparaison des solutions

| Solution | Prix | Facilité | Qualité | Vitesse | Recommandé |
|----------|------|----------|---------|---------|-----------|
| **Shotstack** | 9$/mois | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ **OUI** |
| Cloudinary | 99$/mois | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⚠️ Plus cher |
| AWS MediaConvert | Pay-per-use | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⚠️ Plus complexe |
| FFmpeg local | Gratuit | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ Impossible Vercel |

---

## 🎯 Ma recommandation : **SHOTSTACK**

**Pourquoi Shotstack est parfait pour vous :**
1. **Simple** : 20 lignes de code
2. **Gratuit pour tester** : Mode sandbox avec watermark
3. **Pas de serveur** : Fonctionne sur Vercel
4. **Support précis** : Découpage à la milliseconde près
5. **Pas cher** : 9$/mois pour 100 vidéos en production

**Setup rapide :**
```bash
# 1. Créer un compte Shotstack
https://dashboard.shotstack.io/register

# 2. Copier votre API key

# 3. Ajouter à .env.local
SHOTSTACK_API_KEY=your_key_here
SHOTSTACK_ENV=sandbox
```

Voulez-vous que j'implémente la solution Shotstack complète dans votre code ? 🚀

### Option 1 : FFmpeg côté serveur (Recommandé)

Pour un vrai montage vidéo, vous aurez besoin de FFmpeg installé sur votre serveur.

#### Installation de FFmpeg

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Télécharger depuis https://ffmpeg.org/download.html
```

#### Implémentation avec FFmpeg

```typescript
// Dans app/api/create-montage/route.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

async function createVideoMontage(clips: ClipTiming[], outputPath: string) {
    // 1. Télécharger les vidéos depuis S3
    for (const clip of clips) {
        const video = await getVideoFromDB(clip.videoId);
        await downloadFromS3(video.s3_url, `/tmp/${clip.videoId}.mp4`);
    }

    // 2. Créer le fichier de concaténation FFmpeg
    const filterComplexParts: string[] = [];
    let concatInputs = '';

    clips.forEach((clip, index) => {
        const inputFile = `/tmp/${clip.videoId}.mp4`;
        
        // Découper le clip selon les timings
        filterComplexParts.push(
            `[${index}:v]trim=start=${clip.startTime}:end=${clip.endTime},setpts=PTS-STARTPTS[v${index}];` +
            `[${index}:a]atrim=start=${clip.startTime}:end=${clip.endTime},asetpts=PTS-STARTPTS[a${index}]`
        );
        
        concatInputs += `[v${index}][a${index}]`;
    });

    // 3. Assembler toutes les parties
    const filterComplex = filterComplexParts.join(';') + 
        `;${concatInputs}concat=n=${clips.length}:v=1:a=1[outv][outa]`;

    // 4. Créer la commande FFmpeg
    const inputFiles = clips.map((clip, i) => `-i /tmp/${clip.videoId}.mp4`).join(' ');
    
    const command = `ffmpeg ${inputFiles} \
        -filter_complex "${filterComplex}" \
        -map "[outv]" -map "[outa]" \
        -c:v libx264 -preset medium -crf 23 \
        -c:a aac -b:a 128k \
        ${outputPath}`;

    // 5. Exécuter FFmpeg
    await execPromise(command);

    // 6. Uploader sur S3
    const fileBuffer = fs.readFileSync(outputPath);
    await uploadToS3(fileBuffer, 'montages/final.mp4');

    // 7. Nettoyer les fichiers temporaires
    clips.forEach(clip => fs.unlinkSync(`/tmp/${clip.videoId}.mp4`));
    fs.unlinkSync(outputPath);
}
```

### Option 2 : Service externe (Plus simple)

Utilisez un service de traitement vidéo comme :

1. **Cloudinary** - API de transformation vidéo
2. **Mux** - API de montage vidéo
3. **AWS MediaConvert** - Service AWS dédié
4. **Shotstack** - API de montage vidéo

Exemple avec Shotstack :

```typescript
import axios from 'axios';

async function createMontageWithShotstack(clips: ClipTiming[]) {
    const timeline = {
        soundtrack: {
            src: 'https://s3.amazonaws.com/shotstack-assets/music/disco.mp3',
        },
        tracks: clips.map((clip, index) => ({
            clips: [{
                asset: {
                    type: 'video',
                    src: clip.s3_url,
                    trim: clip.startTime,
                },
                start: index * 10, // Position dans la timeline
                length: clip.endTime - clip.startTime,
            }],
        })),
    };

    const response = await axios.post(
        'https://api.shotstack.io/v1/render',
        {
            timeline,
            output: {
                format: 'mp4',
                resolution: 'hd',
            },
        },
        {
            headers: {
                'x-api-key': process.env.SHOTSTACK_API_KEY,
            },
        }
    );

    return response.data;
}
```

### Option 3 : Traitement en arrière-plan (Background Jobs)

Pour éviter les timeouts, utilisez un système de queue :

```typescript
// Avec BullMQ ou Vercel Queue
import { Queue } from 'bullmq';

const videoQueue = new Queue('video-montage', {
    connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
    },
});

// Ajouter un job
await videoQueue.add('create-montage', {
    montageId: montage.id,
    clips: clipTimings,
});

// Worker séparé pour traiter les jobs
const worker = new Worker('video-montage', async (job) => {
    const { montageId, clips } = job.data;
    
    // Traiter le montage avec FFmpeg
    await createVideoMontage(clips, montageId);
    
    // Mettre à jour le statut dans la DB
    await updateMontageStatus(montageId, 'completed');
});
```

## 📝 Structure recommandée

```
app/
├── api/
│   ├── create-montage/
│   │   └── route.ts           # Point d'entrée API
│   └── montage-status/
│       └── route.ts           # Vérifier le statut
lib/
├── ffmpeg/
│   ├── montage.ts             # Logique FFmpeg
│   └── s3-download.ts         # Téléchargement S3
└── queue/
    └── video-worker.ts        # Worker de traitement
```

## 🔧 Variables d'environnement nécessaires

```env
# FFmpeg (si en local)
FFMPEG_PATH=/usr/bin/ffmpeg

# Ou service externe
SHOTSTACK_API_KEY=your_api_key
MUX_TOKEN_ID=your_token
MUX_TOKEN_SECRET=your_secret

# Redis pour les queues (optionnel)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 🚀 Déploiement

### Sur Vercel
- ⚠️ FFmpeg n'est pas disponible sur Vercel
- Utilisez une API externe (Shotstack, Mux)
- Ou déployez le worker sur un serveur séparé

### Sur VPS/Server
- Installez FFmpeg
- Configurez un worker avec PM2 ou systemd
- Utilisez Nginx pour le reverse proxy

### Docker
```dockerfile
FROM node:18
RUN apt-get update && apt-get install -y ffmpeg
COPY . /app
WORKDIR /app
RUN npm install
CMD ["npm", "start"]
```

## 📚 Ressources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Shotstack API](https://shotstack.io/docs/)
- [AWS MediaConvert](https://aws.amazon.com/mediaconvert/)
- [Cloudinary Video API](https://cloudinary.com/documentation/video_manipulation_and_delivery)

## 🎯 Prochaines étapes

1. Choisir une méthode (FFmpeg local, API externe, ou AWS)
2. Implémenter la logique de montage
3. Tester avec des vidéos de petite taille
4. Ajouter des notifications de progression
5. Implémenter le téléchargement des montages finaux
