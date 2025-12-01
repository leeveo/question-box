'use client';

import { useEffect, useState } from 'react';
import { supabase, type VideoMontage, type Project } from '@/lib/supabase';
import { useAuth } from '@/app/components/AuthProvider';
import Link from 'next/link';

export default function MontagesPage() {
    const { user } = useAuth();
    const [montages, setMontages] = useState<VideoMontage[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [montageToDelete, setMontageToDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    // Auto-refresh si des montages sont en cours de traitement
    useEffect(() => {
        const hasProcessing = montages.some(m => m.status === 'processing');
        
        if (hasProcessing) {
            const interval = setInterval(() => {
                loadData();
            }, 10000); // Rafraîchir toutes les 10 secondes

            return () => clearInterval(interval);
        }
    }, [montages]);

    const loadData = async () => {
        try {
            // Charger les projets
            const { data: projectsData, error: projectsError } = await supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });

            if (projectsError) throw projectsError;
            setProjects(projectsData || []);

            // Charger tous les montages
            const { data: montagesData, error: montagesError } = await supabase
                .from('video_montages')
                .select('*')
                .order('created_at', { ascending: false });

            if (montagesError) throw montagesError;
            setMontages(montagesData || []);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteMontage = async (montageId: string) => {
        setDeleting(true);
        try {
            const { error } = await supabase
                .from('video_montages')
                .delete()
                .eq('id', montageId);

            if (error) throw error;
            setMontages(montages.filter(m => m.id !== montageId));
            setShowDeleteModal(false);
            setMontageToDelete(null);
        } catch (error) {
            console.error('Error deleting montage:', error);
            alert('Erreur lors de la suppression');
        } finally {
            setDeleting(false);
        }
    };

    const confirmDelete = (montageId: string) => {
        setMontageToDelete(montageId);
        setShowDeleteModal(true);
    };

    const retryMontage = async (montageId: string) => {
        setRetrying(montageId);
        try {
            // Récupérer les détails du montage et ses clips
            const { data: montage, error: montageError } = await supabase
                .from('video_montages')
                .select('*')
                .eq('id', montageId)
                .single();

            if (montageError) throw montageError;

            const { data: clips, error: clipsError } = await supabase
                .from('video_montage_clips')
                .select('*')
                .eq('montage_id', montageId)
                .order('clip_order', { ascending: true });

            if (clipsError) throw clipsError;

            // Récupérer le nom du projet
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('name')
                .eq('id', montage.project_id)
                .single();

            if (projectError) throw projectError;

            // Reformater les clips pour l'API
            const clipTimings = clips.map(clip => ({
                videoId: clip.video_id,
                startTime: clip.start_time,
                endTime: clip.end_time
            }));

            // Relancer la création du montage
            const response = await fetch('/api/create-montage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: montage.project_id,
                    projectName: project.name,
                    clips: clipTimings,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Supprimer l'ancien montage échoué
                await supabase
                    .from('video_montages')
                    .delete()
                    .eq('id', montageId);

                // Recharger les données
                await loadData();
                alert('Le montage a été relancé avec succès !');
            } else {
                throw new Error(data.error || 'Erreur lors de la relance du montage');
            }
        } catch (error) {
            console.error('Error retrying montage:', error);
            alert('Erreur lors de la relance du montage');
        } finally {
            setRetrying(null);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return 'N/A';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        Terminé
                    </span>
                );
            case 'processing':
                return (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        En cours
                    </span>
                );
            case 'failed':
                return (
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                        Échoué
                    </span>
                );
            default:
                return null;
        }
    };

    const getProjectName = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        return project?.name || 'Projet inconnu';
    };

    const filteredMontages = selectedProject === 'all'
        ? montages
        : montages.filter(m => m.project_id === selectedProject);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                <div className="w-10 h-10 border-4 border-[#00BFA5] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Montages Vidéo</h1>
                        <p className="text-gray-500 text-sm mt-1">Gérez vos montages vidéo finaux</p>
                    </div>
                    <button
                        onClick={() => loadData()}
                        className="px-4 py-2 bg-[#7C4DFF] hover:bg-[#6c42e0] text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Rafraîchir
                    </button>
                </div>
            </div>

            {/* Filter */}
            <div className="mb-6 flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Filtrer par projet:</label>
                <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent"
                >
                    <option value="all">Tous les projets</option>
                    {projects.map(project => (
                        <option key={project.id} value={project.id}>
                            {project.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-gray-500 text-sm font-medium">Total Montages</h3>
                        <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                        </svg>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{montages.length}</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-gray-500 text-sm font-medium">Terminés</h3>
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">
                        {montages.filter(m => m.status === 'completed').length}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-gray-500 text-sm font-medium">En cours</h3>
                        <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">
                        {montages.filter(m => m.status === 'processing').length}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-gray-500 text-sm font-medium">Projets</h3>
                        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{projects.length}</p>
                </div>
            </div>

            {/* Montages List */}
            {filteredMontages.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-100">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun montage</h3>
                    <p className="text-gray-500 mb-4">Créez votre premier montage vidéo depuis la page des vidéos d'un projet</p>
                    <Link
                        href="/dashboard/projects"
                        className="inline-block px-4 py-2 bg-[#7C4DFF] hover:bg-[#6c42e0] text-white font-medium rounded-lg transition-colors"
                    >
                        Voir mes projets
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMontages.map((montage) => (
                        <div
                            key={montage.id}
                            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden border border-gray-100"
                        >
                            {/* Montage Preview */}
                            <div className="relative aspect-video bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                {montage.status === 'completed' && montage.s3_url ? (
                                    <video
                                        src={montage.s3_url}
                                        className="w-full h-full object-cover"
                                        controls
                                    />
                                ) : (
                                    <div className="text-center p-6">
                                        <svg className="w-16 h-16 text-white mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                                        </svg>
                                        <p className="text-white text-sm">{getStatusBadge(montage.status)}</p>
                                    </div>
                                )}
                            </div>

                            {/* Montage Info */}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="text-gray-800 font-bold text-sm flex-1">{montage.name}</h3>
                                    {getStatusBadge(montage.status)}
                                </div>

                                <p className="text-sm text-gray-600 mb-3">
                                    <Link 
                                        href={`/dashboard/projects/${montage.project_id}`}
                                        className="text-[#7C4DFF] hover:underline"
                                    >
                                        {getProjectName(montage.project_id)}
                                    </Link>
                                </p>

                                <div className="space-y-1 text-sm text-gray-600 mb-4">
                                    <p className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        {montage.video_count} clip{montage.video_count > 1 ? 's' : ''}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {formatDate(montage.created_at)}
                                    </p>
                                    {montage.duration && (
                                        <p className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatDuration(montage.duration)}
                                        </p>
                                    )}
                                    {montage.file_size && (
                                        <p className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            {formatFileSize(montage.file_size)}
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-3 border-t border-gray-100">
                                    {montage.status === 'completed' && montage.s3_url && (
                                        <a
                                            href={montage.s3_url}
                                            download
                                            className="flex-1 px-3 py-2 bg-[#7C4DFF] hover:bg-[#6c42e0] text-white text-center rounded-lg transition text-sm font-medium"
                                        >
                                            Télécharger
                                        </a>
                                    )}
                                    {montage.status === 'failed' && (
                                        <button
                                            onClick={() => retryMontage(montage.id)}
                                            disabled={retrying === montage.id}
                                            className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-center rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {retrying === montage.id ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Relance...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                    Relancer
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => confirmDelete(montage.id)}
                                        className="px-3 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-medium"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de confirmation de suppression */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn">
                        {/* Header avec gradient rouge */}
                        <div className="p-6 bg-gradient-to-r from-red-500 to-red-600">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white">Supprimer le montage</h3>
                            </div>
                        </div>

                        {/* Contenu */}
                        <div className="p-6">
                            <p className="text-gray-700 leading-relaxed">
                                Êtes-vous sûr de vouloir supprimer ce montage définitivement ? 
                                <span className="block mt-2 font-semibold text-gray-900">Cette action est irréversible.</span>
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setMontageToDelete(null);
                                }}
                                disabled={deleting}
                                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => montageToDelete && deleteMontage(montageToDelete)}
                                disabled={deleting}
                                className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {deleting ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Suppression...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Supprimer définitivement
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
