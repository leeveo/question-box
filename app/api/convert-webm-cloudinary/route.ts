import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, videoId } = await request.json();

    if (!videoUrl || !videoId) {
      return NextResponse.json(
        { error: 'videoUrl et videoId requis' },
        { status: 400 }
      );
    }

    console.log(`🎬 Conversion WebM → MP4 via Cloudinary pour ${videoId}`);
    console.log(`URL source: ${videoUrl}`);

    // Upload vers Cloudinary avec conversion ASYNCHRONE (vidéos trop grandes)
    const uploadResult = await cloudinary.uploader.upload(videoUrl, {
      resource_type: 'video',
      folder: 'questionbox-converted',
      public_id: videoId,
      
      // Conversion asynchrone avec eager transformation
      eager: [
        {
          format: 'mp4',
          quality: 'auto:eco',    // Compression agressive
          video_codec: 'h264',
          audio_codec: 'aac',
          bit_rate: '1m',         // 1 Mbps max
          fps: 25,
        }
      ],
      eager_async: true, // ASYNCHRONE pour grandes vidéos
      eager_notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/cloudinary-webhook`, // Optionnel
    });

    console.log(`📤 Upload lancé, attente de la conversion...`);

    // Polling pour attendre que la conversion soit terminée
    let mp4Ready = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5s × 60)
    let mp4Url = '';
    let fileSize = 0;
    let duration = 0;

    while (!mp4Ready && attempts < maxAttempts) {
      attempts++;
      
      // Attendre 5 secondes entre chaque tentative
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        // Récupérer les infos de la ressource
        const resource = await cloudinary.api.resource(`questionbox-converted/${videoId}`, {
          resource_type: 'video',
        });

        // Vérifier si la transformation eager est prête
        if (resource.eager && resource.eager.length > 0) {
          const mp4Transform = resource.eager[0];
          
          if (mp4Transform.status === 'complete' || mp4Transform.secure_url) {
            mp4Url = mp4Transform.secure_url;
            fileSize = mp4Transform.bytes || resource.bytes;
            duration = resource.duration;
            mp4Ready = true;
            
            console.log(`✅ Conversion terminée (tentative ${attempts}):`);
            console.log(`  - URL MP4: ${mp4Url}`);
            console.log(`  - Taille: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  - Durée: ${duration}s`);
          } else {
            console.log(`⏳ Conversion en cours... (tentative ${attempts}/${maxAttempts})`);
          }
        } else {
          console.log(`⏳ En attente de la transformation... (tentative ${attempts}/${maxAttempts})`);
        }
      } catch (error) {
        console.log(`⏳ Ressource pas encore prête... (tentative ${attempts}/${maxAttempts})`);
      }
    }

    if (!mp4Ready) {
      throw new Error('Timeout: conversion trop longue (> 5 minutes)');
    }

    return NextResponse.json({
      success: true,
      mp4Url,
      originalUrl: videoUrl,
      videoId,
      fileSize,
      duration,
    });

  } catch (error) {
    console.error('❌ Erreur Cloudinary:', error);
    
    return NextResponse.json(
      {
        error: 'Échec de la conversion',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
