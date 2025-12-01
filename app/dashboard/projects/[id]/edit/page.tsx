'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, type Project, type Question } from '@/lib/supabase';
import { useAuth } from '@/app/components/AuthProvider';
import Link from 'next/link';
import { useUploadThing } from '@/lib/uploadthing';

type QuestionInput = {
    id: string;
    text: string;
    dbId?: string; // ID from database if it exists
};

export default function EditProjectPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

    const projectId = params.id as string;

    // Form state
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [responseDuration, setResponseDuration] = useState<number>(8);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
    const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
    const [questions, setQuestions] = useState<QuestionInput[]>([]);

    // UploadThing hook
    const { startUpload, isUploading } = useUploadThing("projectBackground", {
        onClientUploadComplete: (res) => {
            if (res && res[0]) {
                setBackgroundImageUrl(res[0].url);
                setUploadProgress(0);
            }
        },
        onUploadError: (error: Error) => {
            setError(`Erreur d'upload: ${error.message}`);
            setUploadProgress(0);
        },
        onUploadProgress: (progress) => {
            setUploadProgress(progress);
        },
    });

    useEffect(() => {
        if (user && projectId) {
            loadProject();
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

            setName(projectData.name);
            setSlug(projectData.slug);
            setResponseDuration(projectData.response_duration || 8);
            setBackgroundImageUrl(projectData.background_image_url);

            // Load questions
            const { data: questionsData, error: questionsError } = await supabase
                .from('questions')
                .select('*')
                .eq('project_id', projectId)
                .order('order', { ascending: true });

            if (questionsError) throw questionsError;

            const loadedQuestions = (questionsData || []).map((q: Question) => ({
                id: q.id,
                dbId: q.id,
                text: q.text,
            }));

            setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [{ id: '1', text: '' }]);
        } catch (err) {
            console.error('Error loading project:', err);
            setError('Erreur lors du chargement du projet');
        } finally {
            setLoadingData(false);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBackgroundImage(file);
            await startUpload([file]);
        }
    };

    const addQuestion = () => {
        if (questions.length < 10) {
            setQuestions([...questions, { id: Date.now().toString(), text: '' }]);
        }
    };

    const removeQuestion = (id: string) => {
        if (questions.length > 1) {
            setQuestions(questions.filter((q) => q.id !== id));
        }
    };

    const updateQuestion = (id: string, text: string) => {
        setQuestions(questions.map((q) => (q.id === id ? { ...q, text } : q)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setError('');
        setLoading(true);

        try {
            // 1. Update project
            const { error: projectError } = await supabase
                .from('projects')
                .update({
                    name,
                    slug,
                    response_duration: responseDuration,
                    background_image_url: backgroundImageUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', projectId);

            if (projectError) throw projectError;

            // 2. Delete all existing questions
            const { error: deleteError } = await supabase
                .from('questions')
                .delete()
                .eq('project_id', projectId);

            if (deleteError) throw deleteError;

            // 3. Re-insert questions
            const questionsToInsert = questions
                .filter((q) => q.text.trim() !== '')
                .map((q, index) => ({
                    project_id: projectId,
                    text: q.text.trim(),
                    order: index + 1,
                }));

            if (questionsToInsert.length > 0) {
                const { error: questionsError } = await supabase
                    .from('questions')
                    .insert(questionsToInsert);

                if (questionsError) throw questionsError;
            }

            // Redirect to project page
            router.push(`/dashboard/projects/${projectId}`);
        } catch (err) {
            console.error('Project update error:', err);
            if (err instanceof Error) {
                const errorMessage = err.message;
                if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
                    setError(`Conflit détecté : Un projet avec ce slug existe déjà. Détails: ${errorMessage}`);
                } else {
                    setError(`Erreur: ${errorMessage}`);
                }
            } else {
                setError('Une erreur est survenue lors de la mise à jour du projet');
            }
        } finally {
            setLoading(false);
        }
    };

    if (loadingData) {
        return (
            <div className="flex items-center justify-center h-64">
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
                    <Link href={`/dashboard/projects/${projectId}`} className="hover:text-[#7C4DFF]">{name}</Link>
                    <span>&gt;</span>
                    <span className="text-gray-800 font-medium">Modifier</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-800">Modifier le Projet</h1>
                <p className="text-gray-500">Modifiez les informations de votre projet d'enregistrement vidéo</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-red-600 text-sm font-medium">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content - Left Side (2/3) */}
                <div className="lg:col-span-2 space-y-8">
                {/* Project Info */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2">Informations du projet</h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nom du projet *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent transition"
                                placeholder="Ex: Soirée d'entreprise 2024"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Slug (URL) *
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 bg-gray-50 px-3 py-2 rounded-l-lg border border-r-0 border-gray-200">/p/</span>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    required
                                    pattern="[a-z0-9-]+"
                                    className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-r-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent transition"
                                    placeholder="soiree-entreprise-2024"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                                Lettres minuscules, chiffres et tirets uniquement
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Durée de réponse par question *
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    value={responseDuration}
                                    onChange={(e) => setResponseDuration(Number(e.target.value))}
                                    required
                                    min="3"
                                    max="30"
                                    className="w-32 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent transition"
                                />
                                <span className="text-gray-600">secondes</span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                                Entre 3 et 30 secondes (par défaut: 8 secondes)
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Image de fond (optionnel)
                            </label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors cursor-pointer relative">
                                <div className="space-y-1 text-center">
                                    <svg
                                        className="mx-auto h-12 w-12 text-gray-400"
                                        stroke="currentColor"
                                        fill="none"
                                        viewBox="0 0 48 48"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    <div className="flex text-sm text-gray-600">
                                        <label
                                            htmlFor="file-upload"
                                            className="relative cursor-pointer bg-white rounded-md font-medium text-[#7C4DFF] hover:text-[#6c42e0] focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#7C4DFF]"
                                        >
                                            <span>Télécharger un fichier</span>
                                            <input
                                                id="file-upload"
                                                name="file-upload"
                                                type="file"
                                                accept="image/*"
                                                className="sr-only"
                                                onChange={handleImageChange}
                                                disabled={isUploading}
                                            />
                                        </label>
                                        <p className="pl-1">ou glisser-déposer</p>
                                    </div>
                                    <p className="text-xs text-gray-500">PNG, JPG, GIF jusqu'à 4MB</p>
                                </div>
                            </div>

                            {isUploading && (
                                <div className="mt-2">
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className="bg-[#7C4DFF] h-2 rounded-full transition-all"
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Upload en cours... {uploadProgress}%</p>
                                </div>
                            )}
                            {backgroundImageUrl && !isUploading && (
                                <div className="mt-4 space-y-3">
                                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded border border-green-100">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Image uploadée avec succès
                                    </div>

                                    {/* Image Preview */}
                                    <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
                                        <img
                                            src={backgroundImageUrl}
                                            alt="Aperçu de l'image de fond"
                                            className="w-full h-48 object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBackgroundImageUrl(null);
                                                setBackgroundImage(null);
                                            }}
                                            className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg transition"
                                            title="Supprimer l'image"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Questions */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-2">
                        <h2 className="text-lg font-bold text-gray-800">Questions</h2>
                        <button
                            type="button"
                            onClick={addQuestion}
                            disabled={questions.length >= 10}
                            className="px-3 py-1.5 bg-[#7C4DFF] hover:bg-[#6c42e0] text-white rounded text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            + Ajouter une question
                        </button>
                    </div>

                    <div className="space-y-4">
                        {questions.map((question, index) => (
                            <div key={question.id} className="flex gap-3 items-start">
                                <div className="flex-shrink-0 w-8 h-10 flex items-center justify-center bg-gray-50 rounded text-gray-500 font-medium text-sm border border-gray-200">
                                    {index + 1}
                                </div>
                                <input
                                    type="text"
                                    value={question.text}
                                    onChange={(e) => updateQuestion(question.id, e.target.value)}
                                    required
                                    className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent transition"
                                    placeholder="Votre question..."
                                />
                                {questions.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeQuestion(question.id)}
                                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-100"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <p className="mt-4 text-xs text-gray-400">
                        {questions.length}/10 questions • Minimum 1, maximum 10
                    </p>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4 pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-3 bg-[#7C4DFF] hover:bg-[#6c42e0] text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-200"
                    >
                        {loading ? 'Mise à jour en cours...' : 'Mettre à jour le projet'}
                    </button>
                    <Link
                        href={`/dashboard/projects/${projectId}`}
                        className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Annuler
                    </Link>
                </div>
                </div>

                {/* Tips & Examples Sidebar - Right Side (1/3) */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Conseils généraux */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-5 border border-purple-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-purple-900">💡 Conseils</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-purple-800">
                            <li className="flex items-start gap-2">
                                <span className="text-purple-500 mt-0.5">•</span>
                                <span>Posez des questions <strong>courtes et claires</strong></span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-500 mt-0.5">•</span>
                                <span>Utilisez un ton <strong>friendly et engageant</strong></span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-500 mt-0.5">•</span>
                                <span>Adaptez la durée selon la complexité</span>
                            </li>
                        </ul>
                    </div>

                    {/* Questions Fun / Événements */}
                    <div className="bg-gradient-to-br from-pink-50 to-rose-100 rounded-lg p-5 border border-pink-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-pink-500 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-pink-900">🎉 Événements Fun</h3>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs font-semibold text-pink-700 uppercase mb-1">Exemples :</p>
                                <ul className="space-y-1.5 text-sm text-pink-800">
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Quel est ton meilleur souvenir ici ?"
                                    </li>
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Si tu étais un super-héros, quel serait ton pouvoir ?"
                                    </li>
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Raconte-nous une anecdote drôle !"
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Questions Professionnelles */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-5 border border-blue-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-blue-900">💼 Professionnel</h3>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Exemples :</p>
                                <ul className="space-y-1.5 text-sm text-blue-800">
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Pourquoi voulez-vous rejoindre notre équipe ?"
                                    </li>
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Quel est votre plus grand défi professionnel ?"
                                    </li>
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Décrivez votre parcours en 30 secondes"
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Questions Feedback / Témoignages */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg p-5 border border-green-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-green-900">⭐ Témoignages</h3>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs font-semibold text-green-700 uppercase mb-1">Exemples :</p>
                                <ul className="space-y-1.5 text-sm text-green-800">
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Qu'avez-vous pensé de notre service ?"
                                    </li>
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Recommanderiez-vous ce produit à un ami ?"
                                    </li>
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Votre expérience en un mot ?"
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Marketing / Réseaux Sociaux */}
                    <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-lg p-5 border border-orange-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-orange-900">📱 Marketing</h3>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Exemples :</p>
                                <ul className="space-y-1.5 text-sm text-orange-800">
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Pourquoi notre marque vous inspire ?"
                                    </li>
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Partagez votre moment préféré avec nous"
                                    </li>
                                    <li className="bg-white/60 rounded px-2 py-1.5">
                                        "Que changeriez-vous dans notre offre ?"
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
