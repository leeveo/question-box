import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
    // Route pour les images de fond de projet
    projectBackground: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
        .middleware(async () => {
            // Ici vous pouvez ajouter une vérification d'authentification si nécessaire
            return {};
        })
        .onUploadComplete(async ({ metadata, file }) => {
            console.log("Upload complete for file:", file.url);
            return { url: file.url };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
