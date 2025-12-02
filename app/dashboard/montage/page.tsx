'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface Project {
    id: string;
    name: string;
    company_context: string;
    created_at: string;
}

interface Video {
    id: string;
    project_id: string;
    s3_url: string;
    duration: number;
    created_at: string;
    projects: {
        name: string;
    };
}

interface ClipTiming {
    videoId: string;
    startTime: number;
    endTime: number;
    order: number;
}

export default function MontagePage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [videos, setVideos] = useState<Video[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [selectedClips, setSelectedClips] = useState<ClipTiming[]>([]);
    const [isCreatingMontage, setIsCreatingMontage] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [conversionProgress, setConversionProgress] = useState<string>('');
    const [montageStatus, setMontageStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [montages, setMontages] = useState<any[]>([]);
    const [dragging, setDragging] = useState<{ videoId: string; handle: 'start' | 'end' } | null>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Charger les projets
    useEffect(() => {
        const fetchProjects = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setProjects(data);
                if (data.length > 0) {
                    setSelectedProjectId(data[0].id);
                }
            }
            setLoading(false);
        };

        fetchProjects();
    }, []);

    // Charger les vidéos du projet sélectionné
    useEffect(() => {
        if (!selectedProjectId) return;

        const fetchVideos = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select(`
                    *,
                    projects (
                        name
                    )
                `)
                .eq('project_id', selectedProjectId)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setVideos(data);
                // Par défaut, aucune vidéo n'est sélectionnée
                setSelectedClips([]);
            }
        };

        const fetchMontages = async () => {
            const { data, error } = await supabase
                .from('video_montages')
                .select('*')
                .eq('project_id', selectedProjectId)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setMontages(data);
            }
        };

        fetchVideos();
        fetchMontages();
    }, [selectedProjectId]);

    const handleCreateMontage = async () => {
        if (!selectedProjectId || selectedClips.length === 0) {
            alert('Sélectionnez au moins une vidéo');
            return;
        }

        setIsCreatingMontage(true);
        setIsConverting(true);
        setMontageStatus(null);

        try {
            // Étape 1: Convertir toutes les vidéos WebM en MP4
            setConversionProgress('Conversion des vidéos WebM en MP4...');
            const convertedClips = [];
            const mp4UrlsMap = new Map<string, string>();

            // Trier les clips par ordre
            const sortedClips = [...selectedClips].sort((a, b) => a.order - b.order);
            
            for (let i = 0; i < sortedClips.length; i++) {
                const clip = sortedClips[i];
                const video = videos.find(v => v.id === clip.videoId);
                
                if (!video) continue;

                setConversionProgress(`Conversion ${i + 1}/${sortedClips.length}...`);

                // Vérifier si c'est du WebM
                if (video.s3_url.includes('.webm')) {
                    try {
                        const convertResponse = await fetch('/api/convert-video', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                videoId: video.id,
                                webmUrl: video.s3_url,
                                duration: video.duration, // Passer la durée de la vidéo
                            }),
                        });

                        const convertResult = await convertResponse.json();

                        if (convertResponse.ok && convertResult.mp4Url) {
                            // Stocker l'URL MP4 pour l'utiliser dans le montage
                            mp4UrlsMap.set(video.id, convertResult.mp4Url);
                            
                            // Mettre à jour la base de données avec l'URL MP4
                            await supabase
                                .from('videos')
                                .update({ s3_url: convertResult.mp4Url })
                                .eq('id', video.id);

                            convertedClips.push(clip);
                        } else {
                            throw new Error(`Échec conversion: ${convertResult.error}`);
                        }
                    } catch (error) {
                        console.error('Erreur conversion:', error);
                        setMontageStatus(`❌ Erreur lors de la conversion de la vidéo ${i + 1}`);
                        return;
                    }
                } else {
                    // Déjà en MP4
                    mp4UrlsMap.set(video.id, video.s3_url);
                    convertedClips.push(clip);
                }
            }

            setIsConverting(false);
            setConversionProgress('');

            // Étape 2: Créer le montage avec les URLs MP4
            setMontageStatus('Création du montage en cours...');
            const selectedProject = projects.find(p => p.id === selectedProjectId);
            
            const response = await fetch('/api/create-montage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProjectId,
                    projectName: selectedProject?.name || 'Montage',
                    clips: convertedClips,
                    mp4Urls: Object.fromEntries(mp4UrlsMap),
                }),
            });

            const result = await response.json();

            if (response.ok) {
                setMontageStatus(
                    `✅ ${result.montage.message || 'Montage créé avec succès !'}`
                );
                // Rafraîchir la liste des montages
                const { data } = await supabase
                    .from('video_montages')
                    .select('*')
                    .eq('project_id', selectedProjectId)
                    .order('created_at', { ascending: false });
                if (data) setMontages(data);
            } else {
                setMontageStatus(
                    `❌ Erreur: ${result.error || 'Échec de la création du montage'}`
                );
            }
        } catch (error) {
            console.error('Error creating montage:', error);
            setMontageStatus('❌ Erreur réseau lors de la création du montage');
        } finally {
            setIsCreatingMontage(false);
            setIsConverting(false);
        }
    };

    const updateClipTiming = (videoId: string, field: 'startTime' | 'endTime', value: number) => {
        setSelectedClips((prev) =>
            prev.map((clip) =>
                clip.videoId === videoId ? { ...clip, [field]: value } : clip
            )
        );
    };

    const removeClip = (videoId: string) => {
        setSelectedClips((prev) => {
            const filtered = prev.filter((clip) => clip.videoId !== videoId);
            // Réorganiser les ordres
            return filtered.map((c, i) => ({ ...c, order: i + 1 }));
        });
    };

    const moveClip = (fromIndex: number, toIndex: number) => {
        setSelectedClips((prev) => {
            const newClips = [...prev];
            const [movedClip] = newClips.splice(fromIndex, 1);
            newClips.splice(toIndex, 0, movedClip);
            return newClips.map((c, i) => ({ ...c, order: i + 1 }));
        });
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, toIndex: number) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        if (fromIndex !== toIndex) {
            moveClip(fromIndex, toIndex);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C4DFF]"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2"> Montage Vidéo</h1>
                <p className="text-gray-600">
                    Créez des montages professionnels. 
                </p>
            </div>

            {/* Mini Tutorial */}
            <div className="mb-8 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                   
                    Comment créer un montage vidéo ?
                </h3>
                
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                            1
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 mb-1">Sélectionnez vos vidéos</h4>
                            <p className="text-sm text-gray-600">
                                Cliquez sur <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">➕ Ajouter</span> pour choisir les vidéos à inclure dans votre montage.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                            2
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 mb-1">Ajustez les timings</h4>
                            <p className="text-sm text-gray-600">
                                Utilisez les sliders <span className="font-medium text-purple-600">Début</span> et <span className="font-medium text-purple-600">Fin</span> pour découper chaque clip. La vidéo se positionne automatiquement.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                            3
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 mb-1">Organisez l'ordre</h4>
                            <p className="text-sm text-gray-600">
                                Cliquez sur les flèches <span className="font-medium">⬆️ ⬇️</span> pour réorganiser l'ordre des vidéos dans votre montage final.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                            4
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 mb-1">Créez votre montage</h4>
                            <p className="text-sm text-gray-600">
                                Cliquez sur <span className="px-2 py-0.5 bg-purple-600 text-white rounded font-medium">                                                   
                    Créer le montage</span> et patientez quelques minutes. Votre vidéo sera prête en HD !
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-purple-200">
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="text-lg">💡</span>
                        <span><strong>Astuce :</strong> Prévisualisez vos clips avec les contrôles vidéo avant de créer le montage final.</span>
                    </p>
                </div>
            </div>

            {/* Sélecteur de projet */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                     Sélectionner un projet
                </label>
                <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent transition-all"
                >
                    {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                            {project.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Liste des vidéos disponibles - Format ligne */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                     Vidéos disponibles ({videos.length})
                </h2>

                {videos.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <svg
                            className="w-16 h-16 mx-auto mb-4 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                        </svg>
                        <p>Aucune vidéo dans ce projet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                    <div className="space-y-3">
                        {[...selectedClips].sort((a, b) => a.order - b.order).map((clip, index) => {
                            const video = videos.find(v => v.id === clip.videoId);
                            if (!video) return null;

                            return (
                                <div
                                    key={clip.videoId}
                                    className="flex items-center gap-4 bg-gradient-to-r from-purple-50 to-white border-2 border-purple-300 rounded-xl p-4 hover:shadow-lg hover:border-purple-400 transition-all group"
                                >
                                    {/* Ordre + Flèches */}
                                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                                        <button
                                            onClick={() => {
                                                if (index > 0) {
                                                    moveClip(index, index - 1);
                                                }
                                            }}
                                            disabled={index === 0}
                                            className="w-8 h-8 flex items-center justify-center text-purple-600 hover:bg-purple-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="Monter"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        </button>
                                        
                                        <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                                            #{clip.order}
                                        </div>
                                        
                                        <button
                                            onClick={() => {
                                                if (index < selectedClips.length - 1) {
                                                    moveClip(index, index + 1);
                                                }
                                            }}
                                            disabled={index === selectedClips.length - 1}
                                            className="w-8 h-8 flex items-center justify-center text-purple-600 hover:bg-purple-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="Descendre"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Preview vidéo - Plus grande */}
                                    <div className="flex-shrink-0 w-48 h-27 relative rounded-lg overflow-hidden bg-black shadow-lg">
                                        <video
                                            id={`video-${video.id}`}
                                            src={video.s3_url}
                                            className="w-full h-full object-cover"
                                            controls
                                            onLoadedMetadata={(e) => {
                                                const videoEl = e.currentTarget;
                                                const detectedDuration = Math.floor(videoEl.duration);
                                                
                                                if (!video.duration && detectedDuration > 0) {
                                                    setVideos(prev => prev.map(v => 
                                                        v.id === video.id ? { ...v, duration: detectedDuration } : v
                                                    ));
                                                    setSelectedClips(prev => prev.map(c =>
                                                        c.videoId === video.id ? { ...c, endTime: detectedDuration } : c
                                                    ));
                                                    
                                                    supabase
                                                        .from('videos')
                                                        .update({ duration: detectedDuration })
                                                        .eq('id', video.id)
                                                        .then();
                                                }
                                                
                                                videoEl.currentTime = clip.startTime;
                                            }}
                                            onTimeUpdate={(e) => {
                                                const videoEl = e.currentTarget;
                                                if (videoEl.currentTime >= clip.endTime) {
                                                    videoEl.currentTime = clip.startTime;
                                                    videoEl.pause();
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Infos vidéo */}
                                    <div className="flex-shrink-0 w-32">
                                        <div className="text-sm font-semibold text-gray-800 mb-1 truncate">
                                            📹 Vidéo {index + 1}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            Durée: {video.duration}s
                                        </div>
                                        <div className="text-xs font-bold text-purple-600 mt-1">
                                            Clip: {(clip.endTime - clip.startTime).toFixed(1)}s
                                        </div>
                                    </div>

                                    {/* Timeline de sélection - Plus compacte */}
                                    <div className="flex-1 min-w-0 max-w-md">
                                        <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                                            <span className="font-medium">⏩ {clip.startTime.toFixed(1)}s</span>
                                            <span className="font-medium">⏸️ {clip.endTime.toFixed(1)}s</span>
                                        </div>
                                        
                                        {/* Barre de visualisation */}
                                        <div className="relative h-6 bg-gray-300 rounded-lg mb-2">
                                            {video.duration && video.duration > 0 ? (
                                                <div
                                                    className="absolute top-0.5 h-5 bg-gradient-to-r from-[#7C4DFF] to-purple-500 rounded shadow"
                                                    style={{
                                                        left: `${(clip.startTime / video.duration) * 100}%`,
                                                        width: `${((clip.endTime - clip.startTime) / video.duration) * 100}%`,
                                                    }}
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                                                    Chargement...
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Sliders */}
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-500 mb-0.5 block">Début</label>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={video.duration ? (clip.endTime - 0.5).toFixed(1) : 10}
                                                    step={0.1}
                                                    value={clip.startTime}
                                                    onChange={(e) => {
                                                        const newStart = parseFloat(e.target.value);
                                                        updateClipTiming(video.id, 'startTime', newStart);
                                                        const videoEl = document.getElementById(`video-${video.id}`) as HTMLVideoElement;
                                                        if (videoEl) {
                                                            videoEl.currentTime = newStart;
                                                        }
                                                    }}
                                                    disabled={!video.duration || video.duration === 0}
                                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                            
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-500 mb-0.5 block">Fin</label>
                                                <input
                                                    type="range"
                                                    min={(clip.startTime + 0.5).toFixed(1)}
                                                    max={video.duration || 10}
                                                    step={0.1}
                                                    value={clip.endTime}
                                                    onChange={(e) => {
                                                        const newEnd = parseFloat(e.target.value);
                                                        updateClipTiming(video.id, 'endTime', newEnd);
                                                    }}
                                                    disabled={!video.duration || video.duration === 0}
                                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bouton retirer */}
                                    <button
                                        onClick={() => removeClip(video.id)}
                                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Retirer du montage"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}

                        {/* Vidéos non sélectionnées */}
                        {videos.filter(v => !selectedClips.find(c => c.videoId === v.id)).map((video) => (
                            <div
                                key={video.id}
                                className="flex items-center gap-4 bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-all"
                            >
                                {/* Placeholder ordre */}
                                <div className="flex-shrink-0 w-12 h-12 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center font-bold text-lg">
                                    —
                                </div>

                                {/* Preview vidéo */}
                                <div className="flex-shrink-0 w-32 h-18 relative rounded-lg overflow-hidden bg-black">
                                    <video
                                        src={video.s3_url}
                                        className="w-full h-full object-cover"
                                        onLoadedMetadata={(e) => {
                                            const videoEl = e.currentTarget;
                                            const detectedDuration = Math.floor(videoEl.duration);
                                            
                                            if (!video.duration && detectedDuration > 0) {
                                                setVideos(prev => prev.map(v => 
                                                    v.id === video.id ? { ...v, duration: detectedDuration } : v
                                                ));
                                                
                                                supabase
                                                    .from('videos')
                                                    .update({ duration: detectedDuration })
                                                    .eq('id', video.id)
                                                    .then();
                                            }
                                        }}
                                    />
                                </div>

                                {/* Infos vidéo */}
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-gray-800 mb-1">
                                        📹 Vidéo non sélectionnée
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        Durée totale: {video.duration ? `${video.duration}s` : 'Détection...'}
                                    </div>
                                </div>

                                {/* Bouton ajouter */}
                                <button
                                    onClick={() => {
                                        const detectedDuration = video.duration || 10;
                                        setSelectedClips(prev => {
                                            const newOrder = prev.length + 1;
                                            return [...prev, {
                                                videoId: video.id,
                                                startTime: 0,
                                                endTime: detectedDuration,
                                                order: newOrder
                                            }];
                                        });
                                    }}
                                    className="flex-shrink-0 px-6 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-medium transition-colors"
                                >
                                    ➕ Ajouter
                                </button>
                            </div>
                        ))}
                    </div>
                    </div>
                )}
            </div>

            {/* Section création du montage */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-sm border border-purple-200 p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                     Créer le montage
                </h2>

                {selectedClips.length === 0 ? (
                    <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                        <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                        </svg>
                        <p className="font-medium">Aucun clip sélectionné</p>
                        <p className="text-sm mt-1">Ajoutez des vidéos pour commencer votre montage</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-4 text-sm">
                                <span className="font-semibold text-gray-700"> Clips sélectionnés: {selectedClips.length}</span>
                                <span className="text-gray-400">|</span>
                                <span className="font-semibold text-gray-700">⏱️ Durée totale: {selectedClips.reduce((acc, clip) => acc + (clip.endTime - clip.startTime), 0).toFixed(1)}s</span>
                            </div>
                        </div>

                        {isConverting && (
                            <div className="p-4 rounded-lg mb-4 bg-blue-100 text-blue-800 flex items-center gap-3">
                                <svg
                                    className="animate-spin h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    ></circle>
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                <span>{conversionProgress}</span>
                            </div>
                        )}

                        {montageStatus && (
                            <div
                                className={`p-4 rounded-lg mb-4 ${
                                    montageStatus.includes('✅')
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                }`}
                            >
                                {montageStatus}
                            </div>
                        )}

                        <button
                            onClick={handleCreateMontage}
                            disabled={isCreatingMontage || selectedClips.length === 0}
                            className="w-full bg-gradient-to-r from-[#7C4DFF] to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-[#7C4DFF] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {isCreatingMontage ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg
                                        className="animate-spin h-5 w-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                    </svg>
                                    Création en cours...
                                </span>
                            ) : (
                                ' Créer le montage avec Shotstack'
                            )}
                        </button>

                        <p className="text-xs text-gray-500 mt-3 text-center">
                            💡 Utilisez les flèches ⬆️ ⬇️ pour réorganiser l'ordre des vidéos dans le montage
                        </p>
                    </>
                )}
            </div>            {/* Montages finaux */}
            {montages.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-6">
                         Montages finaux ({montages.length})
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {montages.map((montage) => (
                            <div
                                key={montage.id}
                                className="border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-lg transition-all bg-gradient-to-br from-white to-gray-50"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 mb-2 text-lg truncate">
                                            {montage.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-3 text-sm">
                                            <span className={`px-3 py-1 rounded-full font-medium ${
                                                montage.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                montage.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                                {montage.status === 'completed' && '✅ Terminé'}
                                                {montage.status === 'processing' && '⏳ En cours...'}
                                                {montage.status === 'failed' && '❌ Échoué'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Infos */}
                                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                                    <div className="flex items-center gap-1">
                                        <span>📹</span>
                                        <span>{montage.video_count} clips</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span>⏱️</span>
                                        <span>{montage.duration}s</span>
                                    </div>
                                    <span className="text-xs text-gray-400 ml-auto">
                                        {new Date(montage.created_at).toLocaleDateString('fr-FR', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>

                                {/* Vidéo preview */}
                                {montage.status === 'completed' && montage.s3_url && (
                                    <>
                                        <div className="relative mb-4" style={{ paddingBottom: '56.25%' }}>
                                            <video
                                                src={montage.s3_url}
                                                controls
                                                className="absolute inset-0 w-full h-full rounded-lg bg-black object-contain"
                                            />
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-3">
                                            <a
                                                href={montage.s3_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#7C4DFF] to-purple-600 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-[#7C4DFF] transition-all shadow-md hover:shadow-lg"
                                            >
                               
                                                <span>Voir</span>
                                            </a>
                                            <a
                                                href={montage.s3_url}
                                                download
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
                                            >
                                     
                                                <span>Télécharger</span>
                                            </a>
                                        </div>
                                    </>
                                )}

                                {/* Processing state */}
                                {montage.status === 'processing' && (
                                    <div className="flex items-center justify-center py-8 text-blue-600">
                                        <svg className="animate-spin h-8 w-8 mr-3" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="font-medium">Création en cours...</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}


        </div>
    );
}
