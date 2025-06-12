import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import fs from 'fs';
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File | null;
    let fileName = formData.get("fileName") as string || `interview-${Date.now()}`;

    if (!videoFile) {
      return NextResponse.json(
        { error: "Aucun fichier vidéo fourni" },
        { status: 400 }
      );
    }

    // Sanitize filename - replace colons and other invalid characters
    fileName = fileName.replace(/[/:*?"<>|\\]/g, '-');
    
    // Create a safe unique filename
    const uniqueFileName = `${fileName}-${Date.now()}.webm`;

    // Ensure the uploads directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    
    // Check if directory exists and create it if it doesn't
    if (!fs.existsSync(uploadDir)) {
      console.log(`Creating directory: ${uploadDir}`);
      await mkdir(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueFileName);
    console.log(`Saving file to: ${filePath}`);

    // Convertir le fichier en ArrayBuffer puis en Buffer
    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Écrire le fichier
    await writeFile(filePath, buffer);
    
    const publicUrl = `/uploads/${uniqueFileName}`;

    return NextResponse.json({ 
      success: true, 
      filePath: publicUrl,
      message: "Vidéo enregistrée avec succès"
    });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la vidéo:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de la vidéo", details: error.message },
      { status: 500 }
    );
  }
}
