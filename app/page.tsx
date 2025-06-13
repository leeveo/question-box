"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Home() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
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

    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch((error) => {
        console.log("Autoplay prevented:", error);
      });
      setIsAudioPlaying(true);
    }

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

  const handleStartExperience = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    router.push("/record");
  };

  return (
    <div className="relative overflow-hidden text-white min-h-screen">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        {isMounted && (
          <Image
            src="/tf1.jpg"
            alt="TF1 Background"
            fill
            quality={100}
            className="object-cover"
            priority
          />
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
          className="text-center max-w-3xl"
          style={
            isMounted
              ? {
                  transform: `translate3d(${mousePosition.x * -10}px, ${mousePosition.y * -10}px, 0)`,
                  transition: "transform 0.1s ease-out",
                }
              : {}
          }
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500">
            Question Box
          </h1>
          <p className="text-xl md:text-2xl mb-4 text-gray-100">
            Prêt à commencer une nouvelle expérience interactive ?
          </p>

          {/* Added description about the experience */}
          <div className="bg-black/30 p-6 rounded-xl mb-12 backdrop-blur-sm">
            <p className="text-lg mb-2">
              <span className="font-bold">L&apos;expérience :</span> Répondez à 5 questions captivantes qui testeront votre intuition et votre créativité.
            </p>
            <p className="text-md text-gray-200">
              Chaque question vous invite à réfléchir différemment. Vos réponses seront enregistrées pour une expérience personnalisée.
            </p>
          </div>

          <button
            onClick={handleStartExperience}
            className="group relative overflow-hidden rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-4 text-xl font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]"
          >
            <span className="relative z-10">Commencer l&apos;expérience</span>
            <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
          </button>
        </div>

        {/* Audio element */}
        <audio ref={audioRef} loop>
          <source src="/buzz.mp3" type="audio/mpeg" />
          Votre navigateur ne supporte pas l&apos;élément audio.
        </audio>

        {/* Audio controls - only shown after client-side mount */}
        {isMounted && (
          <button
            onClick={() => {
              if (audioRef.current) {
                if (isAudioPlaying) {
                  audioRef.current.pause();
                } else {
                  audioRef.current.play();
                }
                setIsAudioPlaying(!isAudioPlaying);
              }
            }}
            className="absolute bottom-8 right-8 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-colors backdrop-blur-sm"
          >
            {isAudioPlaying ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            )}
          </button>
        )}
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
