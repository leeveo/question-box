import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET(request: Request) {
  try {
    // Get the filename from the URL
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName") || `video-${Date.now()}`;
    const fileType = searchParams.get("fileType") || "video/webm";
    
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

    // Create the command for putting an object in S3
    const putObjectCommand = new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET,
      Key: s3Key,
      ContentType: fileType,
    });

    // Generate a pre-signed URL that will be valid for 5 minutes
    const presignedUrl = await getSignedUrl(s3Client, putObjectCommand, { 
      expiresIn: 300 // 5 minutes
    });
    
    // Calculate the final public URL
    const publicUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${s3Key}`;

    return NextResponse.json({
      presignedUrl,
      publicUrl,
      key: s3Key
    });
    
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    return NextResponse.json(
      {
        error: "Error generating upload URL",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
