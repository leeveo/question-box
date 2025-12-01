'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import QuestionOverlay from './QuestionOverlay';
import { supabase } from '@/lib/supabase';

interface VideoRecorderProps {
  questions: string[];
  projectId?: string; // Optional project ID for SaaS mode
  projectSlug?: string; // Optional project slug for redirect
  responseDuration?: number; // Duration in seconds for each question response (default: 8)
}

const VideoRecorder = ({ questions = [], projectId, projectSlug, responseDuration = 8 }: VideoRecorderProps) => {
  const router = useRouter(); // Add the router
  const [isRecording, setIsRecording] = useState(false);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showQuestion, setShowQuestion] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [questionTimer, setQuestionTimer] = useState<number>(responseDuration); // Timer pour chaque question
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [savedVideoPath, setSavedVideoPath] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const redrawIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const questionsRef = useRef(questions);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const showQuestionRef = useRef(showQuestion);

  // Sync refs with state
  useEffect(() => {
    questionsRef.current = questions;
    currentQuestionIndexRef.current = currentQuestionIndex;
    showQuestionRef.current = showQuestion;
  }, [questions, currentQuestionIndex, showQuestion]);

  // Détecter si l'appareil est mobile/tablette et l'orientation
  useEffect(() => {
    const checkDevice = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
      const portrait = window.innerHeight > window.innerWidth;
      setIsMobileDevice(isMobile);
      setIsPortrait(portrait);
      console.log('📱 Détection appareil:', { isMobile, portrait, width: window.innerWidth, height: window.innerHeight });
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

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
    const currentQuestions = questionsRef.current;
    const currentIndex = currentQuestionIndexRef.current;
    const isShowing = showQuestionRef.current;

    if (isShowing && currentQuestions.length > 0 && currentIndex < currentQuestions.length) {
      // Utiliser la fonction de dessin dédiée pour un rendu cohérent et joli
      drawQuestionOverlay(ctx, width, height, currentIndex);
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

      // Generate a unique filename with correct extension
      const isMP4 = videoBlob.type.includes('mp4') || videoBlob.type.includes('h264');
      const extension = isMP4 ? 'mp4' : 'webm';
      const baseFileName = `video-interview-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const fileName = `${baseFileName}.${extension}`;
      console.log('📤 Upload:', fileName, 'Type:', videoBlob.type);
      
      // Step 1: Get a pre-signed URL for direct S3 upload
      const urlResponse = await fetch(
        `/api/get-upload-url?fileName=${encodeURIComponent(baseFileName)}&fileType=${encodeURIComponent(videoBlob.type)}&extension=${extension}`
      );      if (!urlResponse.ok) {
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

      // Step 3: Save video metadata to Supabase if projectId is provided
      if (projectId) {
        setUploadStatus("Enregistrement dans la base de données...");

        const { error: dbError } = await supabase
          .from('videos')
          .insert({
            project_id: projectId,
            s3_url: publicUrl,
            file_size: videoBlob.size,
            // duration and participant_name can be added later if needed
          });

        if (dbError) {
          console.error('Error saving to database:', dbError);
          // Don't throw - video is already uploaded to S3
        } else {
          console.log('Video metadata saved to Supabase');
          
          // Si la vidéo est en WebM, lancer la conversion automatique en MP4
          if (videoBlob.type.includes('webm')) {
            console.log('Vidéo WebM détectée, conversion en MP4 recommandée pour le montage');
            // Note: La conversion pourrait être automatisée ici via l'API convert-video
          }
        }
      }

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

      // Configuration vidéo adaptée selon l'appareil et l'orientation
      const videoConstraints = isMobileDevice && isPortrait ? {
        aspectRatio: { ideal: 9 / 16 }, // Format vertical pour mobile
        width: { ideal: 720 },
        height: { ideal: 1280 },
        facingMode: 'user'
      } : {
        aspectRatio: { ideal: 16 / 9 }, // Format horizontal pour desktop
        width: { ideal: 1280 },
        facingMode: 'user'
      };

      console.log('📹 Configuration caméra:', { isMobileDevice, isPortrait, constraints: videoConstraints });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
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

      // Essayer d'abord MP4, sinon fallback sur WebM
      let options: MediaRecorderOptions | undefined;
      let selectedMimeType = 'video/webm';
      const mimeTypes = [
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];

      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          options = {
            mimeType,
            videoBitsPerSecond: 2500000 // 2.5 Mbps
          };
          console.log('✅ Codec sélectionné:', mimeType);
          break;
        }
      }

      // IMPORTANT: MediaRecorder avec paramètres optimisés
      const mediaRecorder = new MediaRecorder(canvasStream, {
        ...options,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
        mimeType: selectedMimeType
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
        
        const mimeType = options?.mimeType || selectedMimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('📹 Vidéo enregistrée:', {
          type: mimeType,
          size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`
        });
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

      const recordingDuration = (questions.length * responseDuration) + 10; // en secondes
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

    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
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
    const currentQuestions = questionsRef.current;
    if (index >= currentQuestions.length) return;

    const questionText = currentQuestions[index];

    // Adapter la taille selon le format (mobile vertical vs desktop)
    const isVertical = height > width; // Format vertical = mobile
    const overlayHeight = isVertical ? height * 0.15 : height * 0.30; // Plus petit sur mobile vertical
    const overlayWidth = isVertical ? width * 0.90 : width * 0.92;

    const overlayX = (width - overlayWidth) / 2;
    // Sur mobile vertical, placer tout en bas avec marge minimale
    const overlayY = isVertical ? height - overlayHeight - 5 : height - overlayHeight - 40;

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
    ctx.lineWidth = isVertical ? 1 : 2;
    ctx.stroke();

    const badgeSize = isVertical ? 20 : 34; // Badge plus petit sur mobile
    const badgeX = overlayX + (isVertical ? 10 : 20);
    // Ancrer le badge en haut du cadre plutôt que de le centrer verticalement
    // Cela laisse plus de place pour le texte en dessous
    const badgeY = overlayY + (isVertical ? 8 : 20);

    ctx.fillStyle = '#2563EB'; // Bleu vif
    ctx.beginPath();
    ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = `bold ${badgeSize * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${index + 1}`,
      badgeX + badgeSize / 2,
      badgeY + badgeSize / 2
    );

    const titleFontSize = isVertical ? 10 : 18; // Titre plus petit sur mobile
    ctx.font = `bold ${titleFontSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Question ${index + 1}/${currentQuestions.length}`,
      badgeX + badgeSize + (isVertical ? 8 : 15),
      badgeY + badgeSize / 2
    );

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = isVertical ? 1 : 2;
    ctx.beginPath();
    const lineY = badgeY + badgeSize + (isVertical ? 4 : 8);
    ctx.moveTo(overlayX + (isVertical ? 10 : 20), lineY);
    ctx.lineTo(overlayX + overlayWidth - (isVertical ? 10 : 20), lineY);
    ctx.stroke();

    // Ajuster la taille de la police - beaucoup plus petit sur mobile vertical
    const textFontSize = isVertical 
      ? Math.min(14, Math.max(10, Math.floor(width / 50))) // Texte compact sur mobile
      : Math.min(36, Math.max(18, Math.floor(width / 40))); // Normal sur desktop
    ctx.font = `${textFontSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const marginX = isVertical ? 10 : 20;
    const maxLineWidth = overlayWidth - (marginX * 2);
    const words = questionText.split(' ');
    let line = '';
    // Positionner le texte sous la ligne de séparation
    let y = lineY + (isVertical ? 6 : 12);

    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxLineWidth && line !== '') {
        ctx.fillText(line, overlayX + marginX, y);
        line = word;
        y += textFontSize * (isVertical ? 1.2 : 1.3); // Interligne réduit sur mobile
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, overlayX + marginX, y);
  }, []); // No dependencies needed as we use refs

  const startQuestionCycle = () => {
    console.log("Démarrage du cycle des questions");

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
    }

    setCurrentQuestionIndex(0);
    setQuestionTimer(responseDuration); // Réinitialiser le timer

    // Démarrer le countdown visuel pour chaque question
    const startQuestionTimer = () => {
      setQuestionTimer(responseDuration);
      let timeLeft = responseDuration;

      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
      }

      questionTimerRef.current = setInterval(() => {
        timeLeft--;
        setQuestionTimer(timeLeft);

        if (timeLeft <= 0) {
          if (questionTimerRef.current) {
            clearInterval(questionTimerRef.current);
          }
        }
      }, 1000);
    };

    // Démarrer le timer pour la première question
    startQuestionTimer();

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
        if (questionTimerRef.current) {
          clearInterval(questionTimerRef.current);
          questionTimerRef.current = null;
        }
        return;
      }

      console.log(`Passage à la question ${currentIndex + 1}/${questions.length}`);
      setCurrentQuestionIndex(currentIndex);
      
      // Redémarrer le timer pour la nouvelle question
      startQuestionTimer();

    }, responseDuration * 1000); // Durée configurée par question
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
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
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
      // Le rendu est géré par la boucle d'animation principale pour éviter les clignotements
    }
  }, [currentQuestionIndex, questions, isRecording, showQuestion]);

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
    <div className="flex flex-col items-center gap-4 bg-transparent w-full">
      <div
        className={`relative w-full rounded-lg overflow-hidden shadow-xl ${
          isMobileDevice && isPortrait 
            ? 'max-w-sm mx-auto' // Container étroit pour mobile vertical
            : 'md:max-w-6xl' // Container large pour desktop
        }`}
        style={{
          aspectRatio: isMobileDevice && isPortrait ? '9 / 16' : '16 / 9', // Ratio dynamique
          backgroundImage: !isRecording && !videoURL ? 'url("/bg_video.jpg")' : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: isRecording || videoURL ? 'rgba(17, 24, 39, 0.8)' : 'transparent',
          backdropFilter: 'blur(4px)'
        }}
      >
        {!isRecording && !videoURL && !countdown && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center">
            <div className="text-white text-center p-8 max-w-2xl">
              <div className="text-8xl mb-6 drop-shadow-2xl">📹</div>
              <h3 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">Prêt à enregistrer</h3>
              <p className="text-xl md:text-2xl font-medium opacity-90 drop-shadow-md">Cliquez sur le bouton ci-dessous pour commencer</p>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full ${
            isMobileDevice && isPortrait ? 'object-cover' : 'object-contain'
          } ${
            !isRecording && !videoURL && !countdown ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            objectFit: isMobileDevice && isPortrait ? 'cover' : 'contain'
          }}
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
          <div className={`absolute inset-x-0 flex items-center justify-center pointer-events-none ${
            isMobileDevice && isPortrait ? 'bottom-1 px-1' : 'bottom-5 px-4'
          }`}>
            <QuestionOverlay
              questionText={questions[currentQuestionIndex] || ''}
              currentIndex={currentQuestionIndex}
              totalQuestions={questions.length}
            />
          </div>
        )}

        {/* Timer visuel circulaire en haut à droite */}
        {showQuestion && isRecording && !videoURL && (
          <div className={`absolute z-50 ${
            isMobileDevice && isPortrait ? 'top-2 right-2' : 'top-4 right-4'
          }`}>
            <div className={`relative ${
              isMobileDevice && isPortrait ? 'w-16 h-16' : 'w-20 h-20'
            }`}>
              {/* Cercle de fond */}
              <svg className={isMobileDevice && isPortrait ? 'w-16 h-16 transform -rotate-90' : 'w-20 h-20 transform -rotate-90'}>
                <circle
                  cx={isMobileDevice && isPortrait ? "32" : "40"}
                  cy={isMobileDevice && isPortrait ? "32" : "40"}
                  r={isMobileDevice && isPortrait ? "28" : "36"}
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth={isMobileDevice && isPortrait ? "5" : "6"}
                  fill="none"
                />
                {/* Cercle de progression */}
                <circle
                  cx={isMobileDevice && isPortrait ? "32" : "40"}
                  cy={isMobileDevice && isPortrait ? "32" : "40"}
                  r={isMobileDevice && isPortrait ? "28" : "36"}
                  stroke={questionTimer > 3 ? "#10b981" : questionTimer > 1 ? "#f59e0b" : "#ef4444"}
                  strokeWidth={isMobileDevice && isPortrait ? "5" : "6"}
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * (isMobileDevice && isPortrait ? 28 : 36)}`}
                  strokeDashoffset={`${2 * Math.PI * (isMobileDevice && isPortrait ? 28 : 36) * (1 - questionTimer / responseDuration)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              {/* Texte du timer au centre */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`text-center bg-black/70 rounded-full flex flex-col items-center justify-center border-2 border-white/30 ${
                  isMobileDevice && isPortrait ? 'w-12 h-12' : 'w-16 h-16'
                }`}>
                  <span className={`font-bold ${questionTimer > 3 ? 'text-green-400' : questionTimer > 1 ? 'text-amber-400' : 'text-red-400'} ${
                    isMobileDevice && isPortrait ? 'text-lg' : 'text-2xl'
                  }`}>
                    {questionTimer}
                  </span>
                  <span className="text-[7px] text-white/70 -mt-1">sec</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Canvas pour l'enregistrement - rendons-le visible pendant le développement */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            display: isRecording ? 'block' : 'none',
            opacity: 0, // Invisible pour l'utilisateur, mais actif pour l'enregistrement
            zIndex: 40
          }}
        />

        {isRecording && (
          <div className={`absolute bg-red-500 rounded text-xs text-white font-bold animate-pulse ${
            isMobileDevice && isPortrait ? 'top-20 right-2 px-1.5 py-0.5' : 'top-2 right-2 px-2 py-1'
          }`}>
            REC
          </div>
        )}
      </div>

      {/* Boutons d'enregistrement */}
      < div className="flex gap-4 mt-4" >
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isRecording || isPreparing}
            className="group relative overflow-hidden rounded-full bg-gradient-to-r from-red-600 to-orange-600 px-12 py-6 text-2xl md:text-3xl font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] shadow-2xl"
          >
            <span className="relative z-10">
              {isPreparing ? "Préparation..." : "Démarrer l'enregistrement"}
            </span>
            <span className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
          </button>
        ) : null}
      </div >

      {/* Indicateur d'enregistrement */}
      {
        isRecording && (
          <div className="mt-4 text-center bg-black/30 px-4 py-2 rounded-full text-white font-medium animate-pulse">
            Enregistrement en cours... (répondez aux questions)
          </div>
        )
      }

      {/* Modal de la vidéo enregistrée */}
      {
        videoURL && showModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-lg animate-fadeIn">
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-2xl w-full max-w-5xl transform animate-slideIn overflow-hidden border border-gray-700/50">
              {/* En-tête du modal - Design sobre et neutre */}
              <div className="relative overflow-hidden">
                {/* Background gris neutre */}
                <div className="absolute inset-0 bg-gray-700"></div>

                {/* Content container */}
                <div className="relative px-10 py-8 flex justify-between items-center z-10">
                  {/* Left side with icon and title */}
                  <div className="flex items-center space-x-5">
                    <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center shadow-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-white leading-tight tracking-wide">
                        Vidéo enregistrée
                      </h3>
                      <p className="text-gray-300 text-base mt-1">Prête à être visionnée et partagée</p>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setShowModal(false)}
                    className="rounded-full h-10 w-10 bg-gray-600 flex items-center justify-center hover:bg-gray-500 transition-all duration-300 hover:rotate-90"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Decorative element simplifié */}
                <div className="absolute -bottom-6 left-0 w-full h-12 bg-gradient-to-b from-transparent to-gray-800/90"></div>
              </div>

              {/* Corps du modal */}
              <div className="p-6">
                {/* Lecture vidéo */}
                <div className="rounded-lg overflow-hidden shadow-lg">
                  <video
                    src={videoURL}
                    autoPlay
                    loop
                    controls
                    className="w-full bg-black"
                    style={{
                      aspectRatio: isMobileDevice && isPortrait ? '9 / 16' : '16 / 9'
                    }}
                  />
                </div>

                {/* Statut de l'upload */}
                {/* Statut de l'upload supprimé à la demande de l'utilisateur */}
              </div>

              {/* Pied du modal avec boutons d'action */}
              <div className="p-6 bg-gray-900/100 border-t border-gray-700 flex flex-col md:flex-row flex-wrap gap-3">
                <button
                  onClick={() => {
                    // Afficher le pop-up QR code si l'URL S3 existe, sinon télécharger directement
                    if (savedVideoPath) {
                      setShowQRCodeModal(true);
                    } else {
                      const a = document.createElement('a');
                      a.href = videoURL;
                      a.download = `video-interview-${new Date().toISOString()}.webm`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
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

                <button
                  onClick={() => {
                    if (videoURL) {
                      URL.revokeObjectURL(videoURL);
                      setVideoURL(null);
                      setSavedVideoPath(null);
                      setUploadStatus(null);
                      setShowModal(false);
                      localStorage.removeItem('recordedVideoURL');
                      // Navigate to project page or home
                      const redirectUrl = projectSlug ? `/p/${projectSlug}` : '/';
                      router.push(redirectUrl);
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


              </div>
            </div>
          </div>
        )
      }

      {/* Pop-up Modal QR Code */}
      {showQRCodeModal && savedVideoPath && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-lg animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform animate-slideIn overflow-hidden">
            {/* En-tête */}
            <div className="relative overflow-hidden bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 p-6">
              <div className="relative z-10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">QR Code</h3>
                      <p className="text-sm text-white/80">Scannez pour télécharger</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowQRCodeModal(false)}
                    className="rounded-full h-10 w-10 bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all duration-300 hover:rotate-90"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -bottom-6 left-0 w-full h-12 bg-gradient-to-b from-transparent to-white"></div>
            </div>

            {/* Corps du modal avec QR Code */}
            <div className="p-8 bg-white">
              <div className="flex flex-col items-center space-y-6">
                {/* QR Code */}
                <div className="bg-white p-6 rounded-xl shadow-lg border-4 border-gray-100">
                  <QRCodeSVG
                    value={savedVideoPath}
                    size={220}
                    level="H"
                    includeMargin={true}
                    className="rounded-lg"
                  />
                </div>

                {/* Instructions */}
                <div className="text-center space-y-2">
                  <p className="text-gray-700 font-medium">
                    Scannez ce QR code avec votre téléphone
                  </p>
                  <p className="text-sm text-gray-500">
                    pour télécharger votre vidéo
                  </p>
                </div>

                {/* Lien direct */}
                <div className="w-full">
                  <p className="text-xs text-gray-500 text-center mb-2">Ou copiez le lien :</p>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <input
                      type="text"
                      value={savedVideoPath}
                      readOnly
                      className="flex-1 bg-transparent text-xs text-gray-600 outline-none"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(savedVideoPath);
                        alert('Lien copié !');
                      }}
                      className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Copier
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pied du modal */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowQRCodeModal(false)}
                className="w-full py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-medium rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-300"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default VideoRecorder;
