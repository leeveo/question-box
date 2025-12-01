'use client';

import { useState, useEffect } from 'react';

interface QuestionOverlayProps {
  questionText: string;
  currentIndex: number;
  totalQuestions: number;
}

export default function QuestionOverlay({ 
  questionText, 
  currentIndex, 
  totalQuestions 
}: QuestionOverlayProps) {
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
      setIsMobileDevice(isMobile);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, []);

  return (
    <div className={`bg-black/70 backdrop-blur-lg text-white rounded-2xl border-2 border-white/40 shadow-2xl ${
      isMobileDevice 
        ? 'p-3 w-[90%] max-w-xs' // Très compact sur mobile
        : 'p-8 w-full max-w-4xl' // Normal sur desktop
    }`}>
      <div className={`flex items-center ${
        isMobileDevice ? 'mb-2' : 'mb-4'
      }`}>
        <div className={`bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shadow-lg ${
          isMobileDevice 
            ? 'w-8 h-8 mr-2 text-sm' // Badge plus petit sur mobile
            : 'w-14 h-14 mr-4 text-2xl' // Badge normal sur desktop
        }`}>
          {currentIndex + 1}
        </div>
        <h3 className={`font-bold drop-shadow-lg ${
          isMobileDevice 
            ? 'text-xs' // Titre très petit sur mobile
            : 'text-2xl md:text-3xl' // Titre normal sur desktop
        }`}>Question {currentIndex + 1}/{totalQuestions}</h3>
      </div>
      <div className={`border-t-2 border-white/30 ${
        isMobileDevice ? 'pt-2 mt-1' : 'pt-4 mt-3'
      }`}>
        <p className={`font-semibold leading-snug drop-shadow-md ${
          isMobileDevice 
            ? 'text-sm' // Texte compact sur mobile
            : 'text-2xl md:text-3xl leading-relaxed' // Texte normal sur desktop
        }`}>{questionText}</p>
      </div>
    </div>
  );
}
