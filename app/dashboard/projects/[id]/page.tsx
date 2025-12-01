'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, type Project, type Question } from '@/lib/supabase';
import { useAuth } from '@/app/components/AuthProvider';
import Link from 'next/link';

export default function ProjectDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [videoCount, setVideoCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    const projectId = params.id as string;

    useEffect(() => {
        if (user && projectId) {
            loadProject();
        } else if (!user) {
            // If no user, wait for auth or redirect? 
            // AuthProvider handles redirect usually, but let's be safe
        }
    }, [user, projectId]);

    const loadProject = async () => {
        try {
            // Load project
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (projectError) throw projectError;
            setProject(projectData);

            // Load questions
            const { data: questionsData, error: questionsError } = await supabase
                .from('questions')
                .select('*')
                .eq('project_id', projectId)
                .order('order', { ascending: true });

            if (questionsError) throw questionsError;
            setQuestions(questionsData || []);

            // Count videos
            const { count, error: countError } = await supabase
                .from('videos')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', projectId);

            if (countError) throw countError;
            setVideoCount(count || 0);
        } catch (error) {
            console.error('Error loading project:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleProjectStatus = async () => {
        if (!project) return;

        try {
            const { error } = await supabase
                .from('projects')
                .update({ is_active: !project.is_active })
                .eq('id', projectId);

            if (error) throw error;
            setProject({ ...project, is_active: !project.is_active });
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    const deleteProject = async () => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.')) {
            return;
        }

        setDeleting(true);
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId);

            if (error) throw error;
            router.push('/dashboard');
        } catch (error) {
            console.error('Error deleting project:', error);
            alert('Erreur lors de la suppression du projet');
        } finally {
            setDeleting(false);
        }
    };

    const copyPublicUrl = () => {
        if (!project || typeof window === 'undefined') return;
        const url = `${window.location.origin}/p/${project.slug}`;
        navigator.clipboard.writeText(url);
        alert('URL copiée dans le presse-papier !');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-[#00BFA5] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <p className="text-xl mb-4">Projet non trouvé</p>
                <Link href="/dashboard" className="text-[#00BFA5] hover:underline">
                    Retour au tableau de bord
                </Link>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            <Link href="/dashboard" className="hover:text-[#7C4DFF]">Dashboard</Link> &gt; {project.name}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={toggleProjectStatus}
                            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${project.is_active
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {project.is_active ? 'Actif' : 'Inactif'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
                        <svg className="w-6 h-6 text-[#7C4DFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Questions</p>
                        <p className="text-2xl font-bold text-gray-800">{questions.length}</p>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                        <svg className="w-6 h-6 text-[#00BFA5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Vidéos</p>
                        <p className="text-2xl font-bold text-gray-800">{videoCount}</p>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Statut</p>
                        <p className="text-2xl font-bold text-gray-800">{project.is_active ? 'Actif' : 'Inactif'}</p>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Questions List */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">Questions ({questions.length})</h2>
                        <div className="space-y-3">
                            {questions.map((question, index) => (
                                <div key={question.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#7C4DFF] flex items-center justify-center text-white font-bold text-xs mt-0.5">
                                        {index + 1}
                                    </span>
                                    <p className="text-gray-700">{question.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">Actions</h2>
                        <div className="flex flex-wrap gap-3">
                            <Link
                                href={`/dashboard/projects/${projectId}/edit`}
                                className="px-4 py-2 bg-[#7C4DFF] hover:bg-[#6c42e0] text-white font-medium rounded shadow-sm transition-colors"
                            >
                                Modifier le projet
                            </Link>
                            <Link
                                href={`/dashboard/projects/${projectId}/videos`}
                                className="px-4 py-2 bg-[#00BFA5] hover:bg-[#008f7a] text-white font-medium rounded shadow-sm transition-colors"
                            >
                                Voir les vidéos
                            </Link>
                            <button
                                onClick={deleteProject}
                                disabled={deleting}
                                className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium rounded transition-colors disabled:opacity-50"
                            >
                                {deleting ? 'Suppression...' : 'Supprimer'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                    {/* Public URL */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">Lien Public</h2>
                        <p className="text-sm text-gray-500 mb-3">Partagez ce lien pour collecter des vidéos.</p>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${project.slug}`}
                                readOnly
                                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600"
                            />
                            <button
                                onClick={copyPublicUrl}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-200 transition-colors"
                            >
                                Copier
                            </button>
                        </div>
                        <Link
                            href={`/p/${project.slug}`}
                            target="_blank"
                            className="block w-full text-center px-4 py-2 border border-[#7C4DFF] text-[#7C4DFF] hover:bg-purple-50 font-medium rounded transition-colors"
                        >
                            Voir la page publique
                        </Link>
                    </div>

                    {/* Background Image Preview */}
                    {project.background_image_url && (
                        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Image de fond</h2>
                            <div className="rounded-lg overflow-hidden border border-gray-200">
                                <img
                                    src={project.background_image_url}
                                    alt="Background"
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
