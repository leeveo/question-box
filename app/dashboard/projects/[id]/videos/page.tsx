'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, type Video, type Project } from '@/lib/supabase';
import { useAuth } from '@/app/components/AuthProvider';
import Link from 'next/link';

export default function ProjectVideosPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    const projectId = params.id as string;

    useEffect(() => {
        if (user && projectId) {
            loadData();
        }
    }, [user, projectId]);

    const loadData = async () => {
        try {
            // Load project
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (projectError) throw projectError;
            setProject(projectData);

            // Load videos
            const { data: videosData, error: videosError } = await supabase
                .from('videos')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (videosError) throw videosError;
            setVideos(videosData || []);
        } catch (error) {
            console.error('Error loading data:', error);
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
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Link href="/dashboard" className="hover:text-[#7C4DFF]">Dashboard</Link>
                    <span>&gt;</span>
                    <Link href="/dashboard/projects" className="hover:text-[#7C4DFF]">Projets</Link>
                    <span>&gt;</span>
                    <Link href={`/dashboard/projects/${projectId}`} className="hover:text-[#7C4DFF]">{project?.name}</Link>
                    <span>&gt;</span>
                    <span className="text-gray-800 font-medium">Vidéos</span>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Vidéos - {project?.name}</h1>
                        <p className="text-gray-500">{videos.length} vidéo{videos.length > 1 ? 's' : ''} enregistrée{videos.length > 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>

            {videos.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-100">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune vidéo enregistrée</h3>
                    <p className="text-gray-500">Les vidéos apparaîtront ici une fois que des participants auront enregistré leurs réponses</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videos.map((video) => (
                        <div
                            key={video.id}
                            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden border border-gray-100"
                        >
                            {/* Video Preview */}
                            <div className="relative aspect-video bg-black">
                                <video
                                    src={video.s3_url}
                                    className="w-full h-full object-cover"
                                    controls
                                />
                            </div>

                            {/* Video Info */}
                            <div className="p-4">
                                {video.participant_name && (
                                    <h3 className="text-gray-800 font-bold mb-2">{video.participant_name}</h3>
                                )}

                                <div className="space-y-1 text-sm text-gray-600 mb-4">
                                    <p className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {formatDate(video.created_at)}
                                    </p>
                                    {video.duration && (
                                        <p className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatDuration(video.duration)}
                                        </p>
                                    )}
                                    {video.file_size && (
                                        <p className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            {formatFileSize(video.file_size)}
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-3 border-t border-gray-100">
                                    <a
                                        href={video.s3_url}
                                        download
                                        className="flex-1 px-3 py-2 bg-[#7C4DFF] hover:bg-[#6c42e0] text-white text-center rounded-lg transition text-sm font-medium"
                                    >
                                        Télécharger
                                    </a>
                                    <button
                                        onClick={() => deleteVideo(video.id)}
                                        disabled={deleting === video.id}
                                        className="px-3 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-medium disabled:opacity-50"
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
