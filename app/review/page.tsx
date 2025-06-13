'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ReviewPage() {
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState<React.ReactNode[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Generate particles only on the client side
    const newParticles = Array.from({ length: 20 }).map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full bg-white/10"
        style={{
          width: `${Math.random() * 10 + 5}px`,
          height: `${Math.random() * 10 + 5}px`,
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          animation: `float ${Math.random() * 10 + 10}s linear infinite`,
          animationDelay: `${Math.random() * 5}s`,
        }}
      ></div>
    ));
    setParticles(newParticles);

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX / window.innerWidth - 0.5,
        y: e.clientY / window.innerHeight - 0.5,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

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
    
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="relative overflow-hidden text-white min-h-screen">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        {isMounted && (
          <div 
            className="w-full h-full bg-cover bg-center bg-fixed"
            style={{ backgroundImage: 'url("/tf1.jpg")' }}
          ></div>
        )}
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/50 z-10"></div>
      </div>

      {/* Background elements with 3D effects */}
      <div className="absolute inset-0 z-20">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl"
          style={
            isMounted
              ? {
                  transform: `translate3d(${mousePosition.x * 20}px, ${mousePosition.y * 20}px, 0)`,
                  transition: "transform 0.2s ease-out",
                }
              : {}
          }
        ></div>
        <div
          className="absolute bottom-1/3 right-1/3 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl"
          style={
            isMounted
              ? {
                  transform: `translate3d(${mousePosition.x * -30}px, ${mousePosition.y * -30}px, 0)`,
                  transition: "transform 0.3s ease-out",
                }
              : {}
          }
        ></div>
      </div>

      {/* Floating particles - only rendered client-side */}
      {isMounted && <div className="absolute inset-0 z-20">{particles}</div>}

      {/* Main content */}
      <div className="relative z-30 flex flex-col items-center justify-center min-h-screen p-8">
        <div
          className="w-full max-w-4xl text-center"
          style={
            isMounted
              ? {
                  transform: `translate3d(${mousePosition.x * -5}px, ${mousePosition.y * -5}px, 0)`,
                  transition: "transform 0.1s ease-out",
                }
              : {}
          }
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500">
            Revue de votre vidéo
          </h1>
          
          <div className="bg-black/30 p-6 rounded-xl mb-8 backdrop-blur-sm">
            {error ? (
              <div className="bg-red-500/80 text-white p-4 rounded-lg mb-4 text-center">
                {error}
              </div>
            ) : videoURL ? (
              <div className="flex flex-col items-center">
                <video 
                  src={videoURL} 
                  autoPlay
                  loop
                  className="w-full max-w-4xl rounded-lg shadow-2xl mb-6"
                  style={{ maxHeight: '70vh' }}
                />
                
                <div className="flex gap-4 mt-6 flex-wrap justify-center">
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = videoURL;
                      a.download = `video-interview-${new Date().toISOString()}.webm`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="group relative overflow-hidden rounded-full bg-gradient-to-r from-red-600 to-orange-600 px-8 py-4 text-xl font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]"
                  >
                    <span className="relative z-10">Télécharger</span>
                    <span className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  </button>
                  
                  <Link
                    href="/record"
                    className="group relative overflow-hidden rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-4 text-xl font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]"
                  >
                    <span className="relative z-10">Retour à l&apos;enregistrement</span>
                    <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
