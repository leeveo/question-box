'use client';

import { useEffect, useState } from 'react';
import { supabase, type Video, type Project } from '@/lib/supabase';
import { useAuth } from '@/app/components/AuthProvider';
import Link from 'next/link';

type VideoWithProject = Video & {
    projects: Project;
};

export default function GlobalVideosPage() {
    const { user } = useAuth();
    const [videos, setVideos] = useState<VideoWithProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            loadVideos();
        }
    }, [user]);

    const loadVideos = async () => {
        try {
            // Load all videos with project info
            const { data, error } = await supabase
                .from('videos')
                .select('*, projects(*)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setVideos((data as unknown as VideoWithProject[]) || []);
        } catch (error) {
            console.error('Error loading videos:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteVideo = async (videoId: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette vidéo ?')) {
            return;
        }

        setDeleting(videoId);
        try {
            const { error } = await supabase
                .from('videos')
                .delete()
                .eq('id', videoId);

            if (error) throw error;
            setVideos(videos.filter(v => v.id !== videoId));
        } catch (error) {
            console.error('Error deleting video:', error);
            alert('Erreur lors de la suppression');
        } finally {
            setDeleting(null);
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

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-white text-xl">Chargement...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800">Galerie Vidéo</h1>
                <p className="text-gray-500 text-sm mt-1">Gérez l'ensemble des vidéos enregistrées sur vos projets</p>
            </div>

            {videos.length === 0 ? (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 text-center border border-gray-700">
                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400 text-lg mb-2">Aucune vidéo enregistrée</p>
                    <Link href="/dashboard" className="text-purple-400 hover:text-purple-300">
                        Créer un projet pour commencer
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videos.map((video) => (
                        <div
                            key={video.id}
                            className="bg-white rounded-2xl shadow-lg hover:shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1 group"
                        >
                            {/* Video Preview */}
                            <div className="relative aspect-video bg-gray-100 group-hover:brightness-105 transition-all">
                                <video
                                    src={video.s3_url}
                                    className="w-full h-full object-cover"
                                    controls
                                />
                                <div className="absolute top-3 left-3">
                                    <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-purple-600 shadow-sm">
                                        {video.projects?.name || 'Projet inconnu'}
                                    </span>
                                </div>
                            </div>

                            {/* Video Info */}
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-gray-500 text-xs mt-1 font-medium">
                                            {formatDate(video.created_at)}
                                        </p>
                                    </div>
                                    {video.duration && (
                                        <span className="flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {formatDuration(video.duration)}
                                        </span>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-50">
                                    <a
                                        href={video.s3_url}
                                        download
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#7C4DFF] to-purple-600 text-white hover:from-purple-600 hover:to-[#7C4DFF] rounded-xl transition-all shadow-md hover:shadow-lg text-sm font-semibold group/btn"
                                    >
                                        <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Télécharger
                                    </a>
                                    <button
                                        onClick={() => deleteVideo(video.id)}
                                        disabled={deleting === video.id}
                                        className="px-4 py-2.5 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                                        title="Supprimer"
                                    >
                                        {deleting === video.id ? (
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
