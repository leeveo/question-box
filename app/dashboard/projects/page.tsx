'use client';
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';
import { supabase, type Project } from '@/lib/supabase';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

export default function ProjectsListPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }

        if (user) {
            loadProjects();
        }
    }, [user, authLoading, router]);

    const loadProjects = async () => {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProjects(data || []);
        } catch (error) {
            console.error('Error loading projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyPublicUrl = (slug: string, projectId: string) => {
        const url = `${window.location.origin}/p/${slug}`;
        navigator.clipboard.writeText(url);
        setCopiedId(projectId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                <div className="w-10 h-10 border-4 border-[#00BFA5] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Mes Projets</h1>
                    <p className="text-gray-500 text-sm mt-1">Gérez tous vos projets vidéo</p>
                </div>

                <Link
                    href="/dashboard/projects/new"
                    className="inline-flex items-center px-4 py-2 bg-[#FF5252] hover:bg-[#ff1744] text-white text-sm font-medium rounded shadow-md transition-colors"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nouveau Projet
                </Link>
            </div>

            {/* Projects Grid */}
            {projects.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-100">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun projet</h3>
                    <p className="text-gray-500 mb-6">Commencez par créer votre premier projet.</p>
                    <Link
                        href="/dashboard/projects/new"
                        className="text-[#00BFA5] font-medium hover:underline"
                    >
                        Créer un projet
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => {
                        const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${project.slug}`;

                        return (
                            <div
                                key={project.id}
                                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1 group"
                            >
                                {/* Project Header/Image */}
                                <div className="relative h-48 bg-gray-100 group-hover:brightness-105 transition-all">
                                    {project.background_image_url ? (
                                        <img
                                            src={project.background_image_url}
                                            alt={project.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
                                            <svg className="w-16 h-16 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full shadow-sm backdrop-blur-md ${project.is_active
                                                ? 'bg-green-100/90 text-green-700'
                                                : 'bg-gray-100/90 text-gray-600'
                                            }`}>
                                            {project.is_active ? 'ACTIF' : 'INACTIF'}
                                        </span>
                                    </div>
                                </div>

                                {/* Project Body */}
                                <div className="p-6">
                                    <div className="mb-6">
                                        <h3 className="text-xl font-bold text-gray-800 mb-1 leading-tight">{project.name}</h3>
                                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">/{project.slug}</p>
                                    </div>

                                    {/* Public URL Section */}
                                    <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 group-hover:border-purple-100 transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Lien Public</span>
                                            <button
                                                onClick={() => copyPublicUrl(project.slug, project.id)}
                                                className="text-xs px-3 py-1.5 bg-white hover:bg-purple-50 text-gray-600 hover:text-purple-600 rounded-lg border border-gray-200 hover:border-purple-200 transition-all font-medium shadow-sm"
                                            >
                                                {copiedId === project.id ? '✓ Copié' : 'Copier le lien'}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-500 truncate font-mono">
                                                {publicUrl}
                                            </div>
                                        </div>
                                    </div>

                                    {/* QR Code */}
                                    <div className="mb-6 flex justify-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm group-hover:shadow-md transition-all">
                                        <QRCodeSVG
                                            value={publicUrl}
                                            size={100}
                                            level="M"
                                            includeMargin={false}
                                            className="w-24 h-24"
                                        />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <Link
                                            href={`/dashboard/projects/${project.id}`}
                                            className="flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-[#7C4DFF] to-purple-600 text-white hover:from-purple-600 hover:to-[#7C4DFF] rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
                                        >
                                            Gérer
                                        </Link>
                                        <Link
                                            href={`/dashboard/projects/${project.id}/videos`}
                                            className="flex items-center justify-center px-4 py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-sm font-semibold transition-all"
                                        >
                                            Voir Vidéos
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
