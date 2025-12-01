'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, type Project, type Question } from '@/lib/supabase';
import VideoRecorder from '@/app/record/components/VideoRecorder';

export default function PublicRecordingPage() {
    const params = useParams();
    const slug = params.slug as string;

    const [project, setProject] = useState<Project | null>(null);
    const [questions, setQuestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        loadProject();
    }, [slug]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: (e.clientX / window.innerWidth) * 100,
                y: (e.clientY / window.innerHeight) * 100,
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const loadProject = async () => {
        try {
            // Load project by slug
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .eq('slug', slug)
                .eq('is_active', true)
                .single();

            if (projectError) {
                if (projectError.code === 'PGRST116') {
                    setError('Projet non trouvé ou inactif');
                } else {
                    throw projectError;
                }
                setLoading(false);
                return;
            }

            setProject(projectData);

            // Load questions
            const { data: questionsData, error: questionsError } = await supabase
                .from('questions')
                .select('*')
                .eq('project_id', projectData.id)
                .order('order', { ascending: true });

            if (questionsError) throw questionsError;

            // Extract question texts
            const questionTexts = (questionsData || []).map((q: Question) => q.text);
            setQuestions(questionTexts);
        } catch (err) {
            console.error('Error loading project:', err);
            setError('Erreur lors du chargement du projet');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
                <div className="text-white text-xl">Chargement...</div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-4">Projet introuvable</h1>
                    <p className="text-gray-400">{error || 'Ce projet n\'existe pas ou a été désactivé'}</p>
                </div>
            </div>
        );
    }

    const backgroundStyle = project.background_image_url
        ? {
            backgroundImage: `url(${project.background_image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        }
        : {};

    return (
        <div
            className="relative min-h-screen overflow-hidden"
            style={backgroundStyle}
        >
            {/* Overlay for better text readability if background image exists */}
            {project.background_image_url && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            )}

            {/* Animated background gradient (only if no background image) */}
            {!project.background_image_url && (
                <>
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900"></div>
                    <div
                        className="absolute inset-0 opacity-30"
                        style={{
                            background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)`,
                        }}
                    ></div>
                </>
            )}

            {/* Content */}
            <div className="relative z-10">
                <div className="container mx-auto px-4 py-12">
                    {/* Project Title */}
                    <div className="text-center mb-12">
                        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                            {project.name}
                        </h1>
                        <p className="text-xl text-gray-200 drop-shadow">
                            Enregistrez votre vidéo en répondant aux questions
                        </p>
                    </div>

                    {/* Video Recorder */}
                    <div className="bg-black/30 p-6 rounded-xl backdrop-blur-sm">
                        <VideoRecorder 
                            questions={questions} 
                            projectId={project.id} 
                            projectSlug={slug} 
                            responseDuration={project.response_duration || 8}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
