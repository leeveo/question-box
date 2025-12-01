"use client";

import { useState, useEffect } from "react";
import VideoRecorder from './components/VideoRecorder';

// Liste des questions à afficher
const questions = [
  "Quelle place TF1 occupe-t-elle selon vous dans l’histoire de la télévision française ?",
  "Quel programme culte diffusé sur TF1 vous a le plus marqué dans votre jeunesse ?",
  "Quel présentateur ou présentatrice emblématique de TF1 associez-vous le plus à la chaîne ?",
  "Comment TF1 a-t-elle changé selon vous entre les années 1990 et aujourd’hui ?",
  "Quelle place TF1 occupe-t-elle selon vous dans l’histoire de la télévision française ?"
];

export default function RecordPage() {

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
      <div className="relative z-30 flex flex-col items-center justify-center min-h-screen p-4">
        <div
          className="w-full max-w-6xl text-center"
          style={
            isMounted
              ? {
                transform: `translate3d(${mousePosition.x * -5}px, ${mousePosition.y * -5}px, 0)`,
                transition: "transform 0.1s ease-out",
              }
              : {}
          }
        >
          <div className="bg-black/30 p-6 rounded-xl mt-8 backdrop-blur-sm">
            <VideoRecorder questions={questions} />
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
