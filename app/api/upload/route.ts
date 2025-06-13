import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Increase the bodyParser limit for large video uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb' // Increase to 50MB limit
    },
  },
};

export async function POST(request: Request) {
  try {
    console.log("S3 upload started");
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const fileName = formData.get("fileName") as string || `video-${Date.now()}`;

    if (!videoFile) {
      console.log("No video file provided");
      return NextResponse.json(
        { error: "Aucun fichier vidéo fourni" },
        { status: 400 }
      );
    }

    console.log(`Video file received: ${fileName}, size: ${videoFile.size} bytes`);

    // Convertir le fichier en ArrayBuffer puis en Buffer
    const buffer = Buffer.from(await videoFile.arrayBuffer());
    console.log(`Buffer created, length: ${buffer.length}`);

    // Initialize S3 client with debug info
    console.log(`Using AWS region: ${process.env.NEXT_PUBLIC_AWS_REGION}`);
    console.log(`Using S3 bucket: ${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}`);
    console.log(`Using S3 folder: ${process.env.NEXT_PUBLIC_S3_FOLDER}`);
    
    const s3Client = new S3Client({
      region: process.env.NEXT_PUBLIC_AWS_REGION,
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || "",
      },
    });

    // Define S3 path
    const s3Key = `${process.env.NEXT_PUBLIC_S3_FOLDER}/${fileName}.webm`;
    console.log(`S3 key: ${s3Key}`);

    // Upload to S3
    const params = {
      Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: videoFile.type,
    };

    console.log("Uploading to S3...");
    await s3Client.send(new PutObjectCommand(params));
    console.log("Upload to S3 successful");

    // Generate public URL
    const publicUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log(`Generated public URL: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      filePath: publicUrl,
      message: "Vidéo enregistrée avec succès",
    });
  } catch (error) {
    console.error("Error in S3 upload:", error);
    
    // Detailed error reporting
    let errorMessage = "Erreur lors de l'enregistrement de la vidéo";
    let errorDetails = "Unknown error";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || "No stack trace";
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
