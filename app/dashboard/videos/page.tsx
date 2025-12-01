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
                <h1 className="text-3xl font-bold text-white mb-2">Toutes les vidéos</h1>
                <p className="text-gray-400">Gérez l'ensemble des vidéos enregistrées sur vos projets</p>
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
                            className="bg-white-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700 hover:border-purple-500 transition group"
                        >
                            {/* Video Preview */}
                            <div className="relative aspect-video bg-gray-900">
                                <video
                                    src={video.s3_url}
                                    className="w-full h-full object-cover"
                                    controls
                                />
                                <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                                    {video.projects?.name || 'Projet inconnu'}
                                </div>
                            </div>

                            {/* Video Info */}
                            <div className="p-4">
                                {video.participant_name && (
                                    <h3 className="text-white font-medium mb-2">{video.participant_name}</h3>
                                )}

                                <div className="space-y-1 text-sm text-black-400 mb-4">
                                    <p> {formatDate(video.created_at)}</p>
                                    {video.duration && <p>⏱️ {formatDuration(video.duration)}</p>}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <a
                                        href={video.s3_url}
                                        download
                                        className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-center rounded-lg transition text-sm font-medium"
                                    >
                                        Télécharger
                                    </a>
                                    <button
                                        onClick={() => deleteVideo(video.id)}
                                        disabled={deleting === video.id}
                                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50"
                                    >
                                        {deleting === video.id ? '...' : 'Suppr.'}
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
