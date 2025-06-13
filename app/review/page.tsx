'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ReviewPage() {
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Récupérer l'URL de la vidéo depuis localStorage
    try {
      const savedVideoURL = localStorage.getItem('recordedVideoURL');
      if (savedVideoURL) {
        setVideoURL(savedVideoURL);
      } else {
        setError('Aucune vidéo trouvée. Veuillez d&apos;abord enregistrer une vidéo.');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la vidéo:', error);
      setError('Erreur lors du chargement de la vidéo.');
    }
    
    // Nettoyer l'URL lorsque le composant est démonté
    return () => {
      // Ne pas révoquer l'URL ici car nous voulons garder la vidéo pour la page d'enregistrement
    };
  }, []);

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-center items-center"
      style={{
        backgroundImage: 'url("/tf1.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundColor: '#000',
        position: 'relative'
      }}
    >
      {/* Overlay semi-transparent */}
      <div 
        className="absolute inset-0 bg-black/40"
        style={{ position: 'fixed', zIndex: 0 }}
      ></div>
      
      {/* Contenu principal */}
      <div className="w-full max-w-6xl relative z-10 px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-white text-center drop-shadow-lg">
          Revue de votre vidéo
        </h1>
        
        {error ? (
          <div className="bg-red-500/80 text-white p-4 rounded-lg mb-4 text-center">
            {error}
          </div>
        ) : videoURL ? (
          <div className="flex flex-col items-center">
            <video 
              src={videoURL} 
              controls 
              autoPlay
              className="w-full max-w-4xl rounded-lg shadow-2xl mb-6"
              style={{ maxHeight: '70vh' }}
            />
            
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = videoURL;
                  a.download = `video-interview-${new Date().toISOString()}.webm`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-lg"
              >
                Télécharger
              </button>
              
              <Link
                href="/record"
                className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 shadow-lg"
              >
                Retour à l&apos;enregistrement
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
        <p className="text-white p-4 text-center">
          Aucune vidéo n&apos;est disponible pour le moment. Veuillez retourner à la page d&apos;enregistrement.
        </p>
      </div>
    </div>
  );
}
