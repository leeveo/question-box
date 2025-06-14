'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QuestionOverlay from './QuestionOverlay';

interface VideoRecorderProps {
  questions: string[];
}

const VideoRecorder = ({ questions = [] }: VideoRecorderProps) => {
  const router = useRouter(); // Add the router
  const [isRecording, setIsRecording] = useState(false);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showQuestion, setShowQuestion] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [savedVideoPath, setSavedVideoPath] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const redrawIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Retravaillons complètement la méthode de dessin du canvas pour une stabilité maximale
  const drawVideoAndQuestionOnCanvas = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(drawVideoAndQuestionOnCanvas);
      return;
    }
    
    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;
    
    // S'assurer que le canvas a les dimensions exactes de la vidéo
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    
    const ctx = canvas.getContext('2d', { alpha: false }); // Désactiver l'alpha pour de meilleures performances
    if (!ctx) return;
    
    // 1. Dessiner l'image vidéo sur le canvas avec des paramètres optimisés
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, width, height);
    
    // 2. TOUJOURS dessiner la question sur le canvas avec une méthode plus stable
    if (showQuestion && questions.length > 0 && currentQuestionIndex < questions.length) {
      const questionText = questions[currentQuestionIndex];
      
      // Enregistrer l'état du contexte avant de dessiner la question
      ctx.save();
      
      // Utiliser globalCompositeOperation pour un rendu plus stable
      ctx.globalCompositeOperation = 'source-over';
      
      // Dessiner un grand bloc noir OPAQUE en bas de l'écran (pas de transparence)
      ctx.fillStyle = '#000000'; // Noir 100% opaque
      const blockHeight = Math.min(height * 0.25, 150);
      ctx.fillRect(0, height - blockHeight, width, blockHeight);
      
      // Ajouter une bordure blanche en haut du bloc
      ctx.strokeStyle = '#FFFFFF'; // Blanc 100% opaque
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, height - blockHeight);
      ctx.lineTo(width, height - blockHeight);
      ctx.stroke();
      
      // Numéro de question en gros et en blanc
      ctx.fillStyle = '#FFFFFF'; // Blanc 100% opaque
      const fontSize = Math.min(height * 0.05, 30);
      // Utiliser une police plus robuste
      ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      // Dessiner avec une ombre pour meilleure lisibilité
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      
      // Dessiner le numéro de question
      const questionNumberText = `Question ${currentQuestionIndex + 1}/${questions.length}`;
      ctx.fillText(
        questionNumberText,
        width / 2,
        height - blockHeight + 15
      );
      
      // Texte de la question avec des paramètres optimisés
      const questionFontSize = Math.min(height * 0.04, 24);
      ctx.font = `${questionFontSize}px Arial, Helvetica, sans-serif`;
      
      // Dessiner le texte de la question
      ctx.fillText(
        questionText,
        width / 2,
        height - blockHeight + fontSize + 25
      );
      
      // Restaurer l'état du contexte après avoir dessiné la question
      ctx.restore();
      
      // Forcer un redessinage immédiat des éléments clés
      if (redrawIntervalRef.current === null) {
        redrawIntervalRef.current = setInterval(() => {
          if (ctx && showQuestion) {
            // Redessiner uniquement la barre de questions pour stabilité
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, height - blockHeight, width, blockHeight);
            
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, height - blockHeight);
            ctx.lineTo(width, height - blockHeight);
            ctx.stroke();
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
            
            ctx.fillText(
              questionNumberText,
              width / 2,
              height - blockHeight + 15
            );
            
            ctx.font = `${questionFontSize}px Arial, Helvetica, sans-serif`;
            ctx.fillText(
              questionText,
              width / 2,
              height - blockHeight + fontSize + 25
            );
          }
        }, 100); // Redessiner 10 fois par seconde pour garantir la stabilité
      }
    } else if (redrawIntervalRef.current) {
      // Si les questions ne sont plus affichées, arrêter le redessinage forcé
      clearInterval(redrawIntervalRef.current);
      redrawIntervalRef.current = null;
    }
    
    // Continuer la boucle d'animation avec une priorité élevée
    animationFrameRef.current = requestAnimationFrame(drawVideoAndQuestionOnCanvas);
  };
  
  // Ajoutons une méthode de secours pour garantir l'affichage des questions
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const forceDrawQuestionOnCanvas = (shouldDraw: boolean) => {
    if (!isRecording || !canvasRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    // Dessiner l'image vidéo
    ctx.drawImage(videoRef.current, 0, 0, width, height);
    
    // TOUJOURS dessiner la question
    if (questions.length > 0 && currentQuestionIndex < questions.length) {
      const questionText = questions[currentQuestionIndex];
      
      // Rectangle noir en bas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      const blockHeight = Math.min(height * 0.25, 150);
      ctx.fillRect(0, height - blockHeight, width, blockHeight);
      
      // Bordure blanche
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, height - blockHeight);
      ctx.lineTo(width, height - blockHeight);
      ctx.stroke();
      
      // Texte des questions
      ctx.fillStyle = 'white';
      const fontSize = Math.min(height * 0.05, 30);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `Question ${currentQuestionIndex + 1}/${questions.length}`,
        width / 2,
        height - blockHeight + 15
      );
      
      const questionFontSize = Math.min(height * 0.04, 24);
      ctx.font = `${questionFontSize}px Arial`;
      ctx.fillText(
        questionText,
        width / 2,
        height - blockHeight + fontSize + 25
      );
    }
  };

  // Fonction pour envoyer la vidéo au serveur
  const uploadVideoToServer = async (videoBlob: Blob) => {
    try {
      setUploadStatus("Préparation de l'envoi vers AWS S3...");
      
      // Check video size and warn if it's large
      const videoSizeMB = videoBlob.size / (1024 * 1024);
      console.log(`Video size: ${videoSizeMB.toFixed(2)} MB`);
      
      if (videoSizeMB > 20) {
        console.warn(`Large video detected (${videoSizeMB.toFixed(2)} MB). Using direct S3 upload.`);
        setUploadStatus(`Préparation de l'envoi direct (${videoSizeMB.toFixed(1)} MB)...`);
      }
      
      // Generate a unique filename
      const fileName = `video-interview-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      
      // Step 1: Get a pre-signed URL for direct S3 upload
      const urlResponse = await fetch(
        `/api/get-upload-url?fileName=${encodeURIComponent(fileName)}&fileType=${encodeURIComponent(videoBlob.type)}`
      );
      
      if (!urlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${urlResponse.status}`);
      }
      
      const { presignedUrl, publicUrl } = await urlResponse.json();
      
      // Step 2: Upload directly to S3 using the pre-signed URL
      setUploadStatus(`Envoi en cours vers AWS S3 (${videoSizeMB.toFixed(1)} MB)...`);
      
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: videoBlob,
        headers: {
          'Content-Type': videoBlob.type,
        }
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload to S3: ${uploadResponse.status}`);
      }
      
      setUploadStatus("Vidéo enregistrée avec succès sur AWS S3!");
      setSavedVideoPath(publicUrl);
      
      return publicUrl;
    } catch (error) {
      console.error("Erreur lors de l'envoi de la vidéo:", error);
      setUploadStatus(`Échec de l'enregistrement sur AWS S3: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      return null;
    }
  };
  
  const startRecording = async () => {
    if (isPreparing || isRecording) return;
    
    setIsPreparing(true);
    chunksRef.current = [];
    
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: true 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Éviter l'écho
        
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve();
          
          const handleVideoReady = () => {
            videoRef.current?.removeEventListener('loadeddata', handleVideoReady);
            resolve();
          };
          
          if (videoRef.current.readyState >= 2) {
            handleVideoReady();
          } else {
            videoRef.current.addEventListener('loadeddata', handleVideoReady);
          }
        });
      }
      
      // Start the countdown from 3
      setCountdown(3);
      
      // Wait for countdown to finish before starting recording
      await new Promise<void>((resolve) => {
        let count = 3;
        const countdownInterval = setInterval(() => {
          count -= 1;
          setCountdown(count);
          
          if (count <= 0) {
            clearInterval(countdownInterval);
            setCountdown(null); // Remove countdown when done
            resolve();
          }
        }, 1000);
      });
      
      // Après le décompte, activer les questions
      setCurrentQuestionIndex(0);
      setShowQuestion(true);
      
      // Arrêter tout rendu existant
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Démarrer une nouvelle boucle de rendu
      animationFrameRef.current = requestAnimationFrame(drawVideoAndQuestionOnCanvas);
      
      // Attendre un peu avant de démarrer l'enregistrement
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!canvasRef.current) {
        throw new Error("Canvas non trouvé");
      }
      
      // Utiliser une fréquence d'images plus élevée pour le flux
      const canvasStream = canvasRef.current.captureStream(60); // Augmenter à 60 FPS
      
      if (stream.getAudioTracks().length > 0) {
        const audioTrack = stream.getAudioTracks()[0];
        canvasStream.addTrack(audioTrack);
      }
      
      let options: MediaRecorderOptions | undefined;
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          options = { 
            mimeType,
            videoBitsPerSecond: 3000000 // 3 Mbps pour une bonne qualité
          };
          break;
        }
      }
      
      // IMPORTANT: MediaRecorder avec paramètres optimisés pour taille réduite
      const mediaRecorder = new MediaRecorder(canvasStream, {
        ...options,
        videoBitsPerSecond: 2500000, // Réduire à 2.5 Mbps pour une taille plus petite
        audioBitsPerSecond: 128000,  // Réduire à 128 kbps pour l'audio
        mimeType: options?.mimeType || 'video/webm;codecs=vp8,opus' // vp8 est généralement plus léger que vp9
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      // Modification du mediaRecorder.onstop pour afficher la popup
      mediaRecorder.onstop = async () => {
        if (chunksRef.current.length === 0) {
          console.error("Aucune donnée enregistrée");
          setIsPreparing(false);
          return;
        }
        
        const blob = new Blob(chunksRef.current, { type: options?.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setVideoURL(url);
        setShowModal(true); // Afficher la popup quand la vidéo est prête
        
        try {
          localStorage.setItem('recordedVideoURL', url);
          console.log('URL de la vidéo sauvegardée dans localStorage');
          
          // Envoyer automatiquement la vidéo au serveur
          await uploadVideoToServer(blob);
        } catch (error) {
          console.error('Erreur:', error);
        }
      };
      
      // Démarrer l'enregistrement avec des segments plus courts pour une meilleure qualité
      mediaRecorder.start(250); // Segments plus courts pour une meilleure fluidité
      
      console.log("Enregistrement démarré avec canvas de dimensions:", canvasRef.current.width, "x", canvasRef.current.height);
      
      // Ne pas utiliser d'intervalle supplémentaire pour le rendu - requestAnimationFrame suffit
      
      setIsRecording(true);
      setIsPreparing(false);
      
      startQuestionCycle();
      
      const recordingDuration = (questions.length * 5) + 10; // en secondes
      console.log(`Enregistrement programmé pour s'arrêter automatiquement après ${recordingDuration} secondes`);
      
      setTimeout(() => {
        console.log("Exécution de l'arrêt automatique");
        stopRecording();
      }, recordingDuration * 1000);
      
    } catch (error) {
      console.error("Erreur lors de la préparation de l'enregistrement:", error);
      setIsPreparing(false);
      setCountdown(null); // Clear countdown on error
      alert("Erreur lors de l'accès à la caméra. Veuillez vérifier les permissions de votre navigateur.");
    }
  };

  // Add useCallback to prevent recreating this function on every render
  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) {
      console.log("Tentative d'arrêt d'un enregistrement inactif");
      return;
    }
    
    console.log("Arrêt de l'enregistrement");
    
    if (redrawIntervalRef.current) {
      clearInterval(redrawIntervalRef.current);
      redrawIntervalRef.current = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error("Erreur lors de l'arrêt de l'enregistreur:", error);
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsRecording(false);
    setShowQuestion(false);
  }, [isRecording]); // Only recreate if isRecording changes

  const drawQuestionOverlay = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, index: number) => {
    if (index >= questions.length) return;
    
    const questionText = questions[index];
    
    const overlayHeight = height * 0.25;
    const overlayWidth = width * 0.92;
    
    const overlayX = (width - overlayWidth) / 2;
    const overlayY = height - overlayHeight - 20; // 20px de marge en bas
    
    const gradient = ctx.createLinearGradient(overlayX, overlayY, overlayX, overlayY + overlayHeight);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    
    const radius = 10;
    ctx.moveTo(overlayX + radius, overlayY);
    ctx.lineTo(overlayX + overlayWidth - radius, overlayY);
    ctx.quadraticCurveTo(overlayX + overlayWidth, overlayY, overlayX + overlayWidth, overlayY + radius);
    ctx.lineTo(overlayX + overlayWidth, overlayY + overlayHeight - radius);
    ctx.quadraticCurveTo(overlayX + overlayWidth, overlayY + overlayHeight, overlayX + overlayWidth - radius, overlayY + overlayHeight);
    ctx.lineTo(overlayX + radius, overlayY + overlayHeight);
    ctx.quadraticCurveTo(overlayX, overlayY + overlayHeight, overlayX, overlayY + overlayHeight - radius);
    ctx.lineTo(overlayX, overlayY + radius);
    ctx.quadraticCurveTo(overlayX, overlayY, overlayX + radius, overlayY);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const badgeSize = 34;
    const badgeX = overlayX + 20;
    const badgeY = overlayY + (overlayHeight - badgeSize) / 2;
    
    ctx.fillStyle = '#2563EB'; // Bleu vif
    ctx.beginPath();
    ctx.arc(badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'white';
    ctx.font = `bold ${badgeSize * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${index + 1}`, 
      badgeX + badgeSize/2, 
      badgeY + badgeSize/2
    );
    
    ctx.font = `bold 18px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Question ${index + 1}/${questions.length}`, 
      badgeX + badgeSize + 15, 
      badgeY + badgeSize/2
    );
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(overlayX + 20, badgeY + badgeSize + 8);
    ctx.lineTo(overlayX + overlayWidth - 20, badgeY + badgeSize + 8);
    ctx.stroke();
    
    const textFontSize = Math.max(20, Math.floor(width / 32));
    ctx.font = `${textFontSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const maxLineWidth = overlayWidth - 40; // 20px de marge de chaque côté
    const words = questionText.split(' ');
    let line = '';
    let y = badgeY + badgeSize + 20; // Position sous la ligne de séparation
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxLineWidth && line !== '') {
        ctx.fillText(line, overlayX + 20, y);
        line = word;
        y += textFontSize * 1.3;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, overlayX + 20, y);
  }, [questions]); // Only recreate if questions array changes

  const startQuestionCycle = () => {
    console.log("Démarrage du cycle des questions");
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setCurrentQuestionIndex(0);
    
    if (questions.length <= 1) {
      console.log("Une seule question disponible, pas de cycle nécessaire");
      return;
    }
    
    let currentIndex = 0;
    
    timerRef.current = setInterval(() => {
      currentIndex++;
      
      if (currentIndex >= questions.length) {
        console.log("Toutes les questions ont été affichées, fin du cycle");
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      
      console.log(`Passage à la question ${currentIndex + 1}/${questions.length}`);
      setCurrentQuestionIndex(currentIndex);
      
    }, 5000); // 5 secondes par question
  };

  // Use this function in an interval to ensure questions display
  useEffect(() => {
    if (isRecording && currentQuestionIndex === questions.length - 1) {
      console.log("Dernière question atteinte, arrêt programmé dans 10 secondes");
      
      const finalStopTimeout = setTimeout(() => {
        console.log("Délai après la dernière question écoulé, arrêt de l'enregistrement");
        stopRecording();
      }, 10000);
      
      return () => clearTimeout(finalStopTimeout);
    }
  }, [currentQuestionIndex, isRecording, questions.length, stopRecording]); // Added stopRecording

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoURL) {
        URL.revokeObjectURL(videoURL);
      }
    };
  }, [videoURL]);

  // Ajoutons un useEffect pour debug le changement de question
  useEffect(() => {
    if (isRecording && showQuestion) {
      console.log(`Question affichée changée: #${currentQuestionIndex + 1} - "${questions[currentQuestionIndex]}"`);
      
      // Force redraw sur changement de question
      if (canvasRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          const width = canvasRef.current.width;
          const height = canvasRef.current.height;
          ctx.drawImage(videoRef.current, 0, 0, width, height);
          drawQuestionOverlay(ctx, width, height, currentQuestionIndex);
        }
      }
    }
  }, [currentQuestionIndex, questions, isRecording, showQuestion, drawQuestionOverlay]); // Added drawQuestionOverlay

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const drawQuestionOverlayDebug = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    // Dessiner l'image vidéo
    ctx.drawImage(videoRef.current, 0, 0, width, height);
    
    // Dessiner la question actuelle pour débogage
    if (questions.length > 0 && currentQuestionIndex < questions.length) {
      const questionText = questions[currentQuestionIndex];
      
      // Rectangle noir en bas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      const blockHeight = Math.min(height * 0.25, 150);
      ctx.fillRect(0, height - blockHeight, width, blockHeight);
      
      // Bordure blanche
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, height - blockHeight);
      ctx.lineTo(width, height - blockHeight);
      ctx.stroke();
      
      // Texte des questions
      ctx.fillStyle = 'white';
      const fontSize = Math.min(height * 0.05, 30);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `Question ${currentQuestionIndex + 1}/${questions.length}`,
        width / 2,
        height - blockHeight + 15
      );
      
      const questionFontSize = Math.min(height * 0.04, 24);
      ctx.font = `${questionFontSize}px Arial`;
      ctx.fillText(
        questionText,
        width / 2,
        height - blockHeight + fontSize + 25
      );
    }
  };

  // Move animations useEffect inside the component
  useEffect(() => {
    // Create a style element for animations
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      @keyframes slide {
        0% { background-position: 0 0; }
        100% { background-position: 60px 60px; }
      }

      .animate-fadeIn {
        animation: fadeIn 0.3s ease-out forwards;
      }

      .animate-slideIn {
        animation: slideIn 0.4s ease-out forwards;
      }
      
      .animate-slide {
        animation: slide 3s linear infinite;
      }
      
      .shadow-glow {
        box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
      }
      
      .bg-grid-pattern {
        background-image: linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), 
                          linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
        background-size: 20px 20px;
      }
    `;
    
    // Add to document
    document.head.appendChild(styleElement);
    
    // Clean up
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []); // Run once on component mount

  return (
    <div className="flex flex-col items-center gap-4 bg-transparent">
      <div 
        className="relative w-full max-w-6xl aspect-video rounded-lg overflow-hidden shadow-xl"
        style={{
          backgroundImage: !isRecording && !videoURL ? 'url("/bg_video.jpg")' : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: isRecording || videoURL ? 'rgba(17, 24, 39, 0.8)' : 'transparent',
          backdropFilter: 'blur(4px)'
        }}
      >
        {!isRecording && !videoURL && !countdown && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <div className="text-white text-center p-4">
              <div className="text-5xl mb-4">📹</div>
              <h3 className="text-xl font-semibold mb-2">Prêt à enregistrer</h3>
              <p className="opacity-80">Cliquez sur le bouton ci-dessous pour commencer</p>
            </div>
          </div>
        )}
        
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline
          className={`w-full h-full object-cover ${!isRecording && !videoURL && !countdown ? 'opacity-0' : 'opacity-100'}`}
        />
        
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center justify-center">
              {/* Décompte à gauche */}
              <div className="absolute left-10 z-10">
                <div className="w-24 h-24 rounded-full flex items-center justify-center bg-black/70 border-4 border-white">
                  <span className="text-5xl font-bold text-white">{countdown}</span>
                </div>
              </div>
              
              {/* Décompte central */}
              <div className="z-10 animate-pulse">
                <div className="w-32 h-32 rounded-full flex items-center justify-center bg-red-600/80 border-4 border-white">
                  <span className="text-7xl font-bold text-white">{countdown}</span>
                </div>
              </div>
              
              {/* Décompte à droite */}
              <div className="absolute right-10 z-10">
                <div className="w-24 h-24 rounded-full flex items-center justify-center bg-black/70 border-4 border-white">
                  <span className="text-5xl font-bold text-white">{countdown}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Affichage visuel des questions pour l'utilisateur */}
        {showQuestion && questions.length > 0 && !videoURL && (
          <div className="absolute inset-x-0 bottom-5 flex items-center justify-center pointer-events-none px-4">
            <QuestionOverlay 
              questionText={questions[currentQuestionIndex] || ''}
              currentIndex={currentQuestionIndex}
              totalQuestions={questions.length}
            />
          </div>
        )}
        
        {/* Canvas pour l'enregistrement - rendons-le visible pendant le développement */}
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full"
          style={{ 
            display: isRecording ? 'block' : 'none',
            opacity: 0.1, // Légèrement visible pour le débogage
            zIndex: 40
          }}
        />
        
        {isRecording && (
          <div className="absolute top-2 right-2 bg-red-500 px-2 py-1 rounded text-xs text-white font-bold animate-pulse">
            REC
          </div>
        )}
      </div>
      
      {/* Boutons d'enregistrement */}
      <div className="flex gap-4 mt-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isRecording || isPreparing}
            className="group relative overflow-hidden rounded-full bg-gradient-to-r from-red-600 to-orange-600 px-8 py-4 text-xl font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]"
          >
            <span className="relative z-10">
              {isPreparing ? "Préparation..." : "Démarrer l'enregistrement"}
            </span>
            <span className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
          </button>
        ) : null}
      </div>

      {/* Indicateur d'enregistrement */}
      {isRecording && (
        <div className="mt-4 text-center bg-black/30 px-4 py-2 rounded-full text-white font-medium animate-pulse">
          Enregistrement en cours... (répondez aux questions)
        </div>
      )}
      
      {/* Modal de la vidéo enregistrée */}
      {videoURL && showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-lg animate-fadeIn">
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-2xl w-full max-w-3xl transform animate-slideIn overflow-hidden border border-gray-700/50">
            {/* En-tête du modal - Design amélioré */}
            <div className="relative overflow-hidden">
              {/* Gradient background with animation */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-800 via-purple-700 to-pink-800 opacity-90"></div>
              
              {/* Animated pattern overlay */}
              <div className="absolute inset-0 bg-grid-pattern opacity-10 animate-slide"></div>
              
              {/* Content container */}
              <div className="relative px-8 py-6 flex justify-between items-center z-10">
                {/* Left side with icon and title */}
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-glow">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white leading-tight tracking-wide">
                      Vidéo enregistrée
                    </h3>
                    <p className="text-blue-200 text-sm">Prête à être visionnée et partagée</p>
                  </div>
                </div>
                
                {/* Close button */}
                <button 
                  onClick={() => setShowModal(false)}
                  className="rounded-full h-10 w-10 bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all duration-300 hover:rotate-90 border border-white/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -bottom-6 left-0 w-full h-12 bg-gradient-to-b from-transparent to-gray-800/90"></div>
              <div className="absolute bottom-0 left-1/4 w-24 h-24 rounded-full bg-blue-500/30 filter blur-xl"></div>
              <div className="absolute top-0 right-1/4 w-20 h-20 rounded-full bg-purple-500/20 filter blur-xl"></div>
            </div>
            
            {/* Corps du modal */}
            <div className="p-6">
              {/* Lecture vidéo */}
              <div className="rounded-lg overflow-hidden shadow-lg">
                <video 
                  src={videoURL} 
                  autoPlay
                  loop
                  className="w-full aspect-video bg-black"
                />
              </div>
              
              {/* Statut de l'upload */}
              {uploadStatus && (
                <div className={`mt-4 p-3 rounded-lg flex items-center ${
                  uploadStatus.includes('succès') 
                    ? 'bg-green-600/25 border border-green-500/50' 
                    : uploadStatus.includes('Échec') 
                      ? 'bg-red-600/25 border border-red-500/50' 
                      : 'bg-blue-600/25 border border-blue-500/50'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    uploadStatus.includes('succès')
                      ? 'bg-green-500'
                      : uploadStatus.includes('Échec')
                        ? 'bg-red-500'
                        : 'bg-blue-500 animate-pulse'
                  }`}>
                    {uploadStatus.includes('succès') ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : uploadStatus.includes('Échec') ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a7 7 0 10.001 14.001A7 7 0 0010 3zm0 12a5 5 0 100-10 5 5 0 000 10z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-white">{uploadStatus}</p>
                    {savedVideoPath && (
                      <p className="text-white/70 text-sm mt-1">
                        Fichier sauvegardé: <span className="text-blue-400">{savedVideoPath}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Pied du modal avec boutons d'action */}
            <div className="p-6 bg-gray-900/100 border-t border-gray-700 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = videoURL;
                  a.download = `video-interview-${new Date().toISOString()}.webm`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="group relative overflow-hidden rounded-full bg-gradient-to-r from-red-600 to-orange-600 flex-1 px-5 py-3 text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Télécharger la vidéo
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              </button>
              
              {!savedVideoPath && (
                <button
                  onClick={async () => {
                    if (videoURL) {
                      try {
                        const response = await fetch(videoURL);
                        const blob = await response.blob();
                        await uploadVideoToServer(blob);
                      } catch (error) {
                        console.error('Erreur lors de la récupération du blob:', error);
                        setUploadStatus('Échec de l\'enregistrement sur le serveur');
                      }
                    }
                  }}
                  className="group relative overflow-hidden rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 flex-1 px-5 py-3 text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Sauvegarder sur le serveur
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                </button>
              )}
              
              <button
                onClick={() => {
                  if (videoURL) {
                    URL.revokeObjectURL(videoURL);
                    setVideoURL(null);
                    setSavedVideoPath(null);
                    setUploadStatus(null);
                    setShowModal(false);
                    localStorage.removeItem('recordedVideoURL');
                    // Navigate to home page
                    router.push('/');
                  }
                }}
                className="group relative overflow-hidden rounded-full bg-gradient-to-r from-gray-600 to-gray-700 flex-1 px-5 py-3 text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(107,114,128,0.5)]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Nouvel enregistrement
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-gray-500 to-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              </button>
              
              {savedVideoPath && (
                <a
                  href={savedVideoPath}
                  className="group relative overflow-hidden rounded-full bg-gradient-to-r from-green-600 to-emerald-600 flex-1 px-5 py-3 text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    Voir vidéo sauvegardée
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoRecorder;
