import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const fileName = formData.get("fileName") as string || `video-${Date.now()}`;

    if (!videoFile) {
      return NextResponse.json(
        { error: "Aucun fichier vidéo fourni" },
        { status: 400 }
      );
    }

    // Convertir le fichier en ArrayBuffer puis en Buffer
    const buffer = Buffer.from(await videoFile.arrayBuffer());

    // Initialize S3 client
    const s3Client = new S3Client({
      region: process.env.NEXT_PUBLIC_AWS_REGION,
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || "",
      },
    });

    // Define S3 path
    const s3Key = `${process.env.NEXT_PUBLIC_S3_FOLDER}/${fileName}.webm`;

    // Upload to S3
    const params = {
      Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: videoFile.type,
    };

    await s3Client.send(new PutObjectCommand(params));

    // Generate public URL
    const publicUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${s3Key}`;

    return NextResponse.json({
      success: true,
      filePath: publicUrl,
      message: "Vidéo enregistrée avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la vidéo:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de l'enregistrement de la vidéo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable built-in bodyParser to handle file uploads
  },
};
