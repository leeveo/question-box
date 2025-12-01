'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/components/AuthProvider';
import Link from 'next/link';
import { useUploadThing } from '@/lib/uploadthing';

type QuestionInput = {
    id: string;
    text: string;
};

export default function NewProjectPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

    // Form state
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [responseDuration, setResponseDuration] = useState<number>(8);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
    const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
    const [questions, setQuestions] = useState<QuestionInput[]>([
        { id: '1', text: '' },
    ]);

    // AI Question Generation state
    const [companyContext, setCompanyContext] = useState('');
    const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
    const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState('');

    // Category templates with prompts (Actions rapides)
    const categoryTemplates = [
        {
            id: 'fun',
            name: 'Fun',
            emoji: '🎉',
            color: 'from-pink-500 to-rose-500',
            hoverColor: 'hover:from-pink-600 hover:to-rose-600',
            prompt: 'Génère 8 instructions amusantes et fun à faire devant la caméra. Ce sont des actions directes, PAS des questions. Exemples: "Fais un clin d\'œil", "Montre tes meilleurs pouces en l\'air", "Saute de joie", "Fais ta danse de la victoire"'
        },
        {
            id: 'grimaces',
            name: 'Grimaces',
            emoji: '😜',
            color: 'from-yellow-500 to-orange-500',
            hoverColor: 'hover:from-yellow-600 hover:to-orange-600',
            prompt: 'Génère 8 instructions de grimaces à faire devant la caméra. Ce sont des actions directes, PAS des questions. Exemples: "Fais une grimace de singe", "Tire la langue comme un lézard", "Fais une tête de poisson", "Montre ta grimace la plus terrifiante", "Fais une moue boudeuse"'
        },
        {
            id: 'danse',
            name: 'Danse',
            emoji: '💃',
            color: 'from-purple-500 to-pink-500',
            hoverColor: 'hover:from-purple-600 hover:to-pink-600',
            prompt: 'Génère 8 instructions de danse à faire devant la caméra. Ce sont des actions directes, PAS des questions. Exemples: "Danse un rock", "Fais un tour sur toi-même", "Danse le smurf", "Fais le moonwalk", "Bouge tes hanches façon salsa", "Danse comme dans les années 80"'
        },
        {
            id: 'actions',
            name: 'Actions',
            emoji: '🏃',
            color: 'from-blue-500 to-cyan-500',
            hoverColor: 'hover:from-blue-600 hover:to-cyan-600',
            prompt: 'Génère 8 instructions d\'actions physiques à faire devant la caméra. Ce sont des actions directes, PAS des questions. Exemples: "Saute 3 fois", "Fais 5 jumping jacks", "Tourne sur toi-même", "Lève les bras au ciel", "Fais une pompe", "Cours sur place pendant 5 secondes"'
        },
        {
            id: 'imitations',
            name: 'Imitations',
            emoji: '🎭',
            color: 'from-indigo-500 to-purple-500',
            hoverColor: 'hover:from-indigo-600 hover:to-purple-600',
            prompt: 'Génère 8 instructions d\'imitation à faire devant la caméra. Ce sont des actions directes, PAS des questions. Exemples: "Imite un robot", "Fais comme un singe", "Parle comme un pirate", "Marche comme un zombie", "Imite une star qui salue ses fans", "Fais le cri de Tarzan"'
        },
        {
            id: 'chant',
            name: 'Chant',
            emoji: '🎤',
            color: 'from-red-500 to-pink-500',
            hoverColor: 'hover:from-red-600 hover:to-pink-600',
            prompt: 'Génère 8 instructions de chant à faire devant la caméra. Ce sont des actions directes, PAS des questions. Exemples: "Chante joyeux anniversaire", "Rappe ton nom", "Chante la la la la", "Fais une vocalise d\'opéra", "Beatbox pendant 5 secondes", "Chante une comptine"'
        },
        {
            id: 'emotions',
            name: 'Émotions',
            emoji: '🤔',
            color: 'from-green-500 to-emerald-500',
            hoverColor: 'hover:from-green-600 hover:to-emerald-600',
            prompt: 'Génère 8 instructions d\'expression d\'émotions à faire devant la caméra. Ce sont des actions directes, PAS des questions. Exemples: "Fais une happy face", "Prends l\'air triste", "Montre ta surprise", "Fais une tête en colère", "Souris le plus largement possible", "Fais semblant de pleurer"'
        },
        {
            id: 'scene',
            name: 'Mise en scène',
            emoji: '🎬',
            color: 'from-violet-500 to-purple-500',
            hoverColor: 'hover:from-violet-600 hover:to-purple-600',
            prompt: 'Génère 8 instructions de mise en scène à faire devant la caméra. Ce sont des actions directes, PAS des questions. Exemples: "Joue au ralenti", "Fais comme si tu découvrais un trésor", "Mime que tu ouvres une porte secrète", "Fais semblant de tomber", "Joue une scène d\'action", "Mime un lancement de fusée"'
        },
        {
            id: 'creativite',
            name: 'Créativité',
            emoji: '🎨',
            color: 'from-orange-500 to-red-500',
            hoverColor: 'hover:from-orange-600 hover:to-red-600',
            prompt: 'Génère 8 instructions créatives à faire devant la caméra. Ce sont des actions directes, PAS des questions. Exemples: "Dessine un cœur dans les airs", "Fais une sculpture avec ton corps", "Crée une forme avec tes mains", "Invente un mouvement unique", "Fais une pose de statue", "Montre ton talent caché en 3 secondes"'
        },
        {
            id: 'defis',
            name: 'Défis',
            emoji: '⚡',
            color: 'from-yellow-500 to-red-500',
            hoverColor: 'hover:from-yellow-600 hover:to-red-600',
            prompt: 'Génère 8 instructions de défis rapides à faire devant la caméra. Ce sont des actions directes, PAS des questions. Exemples: "Cligne des yeux 10 fois", "Fais rire la caméra", "Dis l\'alphabet à l\'envers", "Touche ton nez avec ta langue", "Fais 3 tours sur toi-même", "Reste immobile comme une statue pendant 5 secondes"'
        }
    ];

    // Event templates with thematic questions
    const eventTemplates = [
        {
            id: 'mariage',
            name: 'Mariage',
            emoji: '💒',
            color: 'from-rose-400 to-pink-500',
            hoverColor: 'hover:from-rose-500 hover:to-pink-600',
            questions: [
                "Quel est ton meilleur souvenir avec les mariés ?",
                "Un conseil pour leur vie de couple ?",
                "Quelle est ta prédiction pour leur avenir ensemble ?",
                "Décris leur amour en 3 mots",
                "Quel moment t'a le plus ému aujourd'hui ?",
                "Un vœu pour leur bonheur ?",
                "Raconte une anecdote drôle sur eux !",
                "Qu'est-ce qui te rend heureux pour eux ?"
            ]
        },
        {
            id: 'anniversaire',
            name: 'Anniversaire',
            emoji: '🎂',
            color: 'from-yellow-400 to-orange-500',
            hoverColor: 'hover:from-yellow-500 hover:to-orange-600',
            questions: [
                "Ton meilleur souvenir avec la personne fêtée ?",
                "Qu'est-ce qui te fait rire chez elle/lui ?",
                "Ton souhait pour cette nouvelle année ?",
                "Décris-la/le en 3 mots !",
                "Quel cadeau invisible lui offres-tu ?",
                "Une qualité que tu admires chez elle/lui ?",
                "Raconte votre première rencontre !",
                "Un message secret pour elle/lui ?"
            ]
        },
        {
            id: 'entreprise',
            name: 'Entreprise',
            emoji: '🏢',
            color: 'from-blue-400 to-indigo-500',
            hoverColor: 'hover:from-blue-500 hover:to-indigo-600',
            questions: [
                "Pourquoi tu aimes travailler ici ?",
                "Ton moment préféré cette année ?",
                "Un mot pour décrire l'équipe ?",
                "Ton défi pour l'année prochaine ?",
                "Qui veux-tu remercier et pourquoi ?",
                "Ta plus grande fierté professionnelle ?",
                "Une valeur de l'entreprise qui te parle ?",
                "Ton souhait pour l'avenir de l'équipe ?"
            ]
        },
        {
            id: 'copains',
            name: 'Entre Copains',
            emoji: '🤝',
            color: 'from-green-400 to-teal-500',
            hoverColor: 'hover:from-green-500 hover:to-teal-600',
            questions: [
                "Ton pire fou rire du groupe ?",
                "Si tu devais décrire le groupe en un mot ?",
                "Ton moment préféré ensemble ?",
                "Avec qui partirais-tu sur une île déserte ?",
                "Un secret que personne ne connaît ?",
                "Quelle est ta blague préférée du groupe ?",
                "Ton souhait pour notre amitié ?",
                "Raconte une aventure mémorable ensemble !"
            ]
        },
        {
            id: 'retrospective',
            name: 'Rétrospective',
            emoji: '📅',
            color: 'from-purple-400 to-violet-500',
            hoverColor: 'hover:from-purple-500 hover:to-violet-600',
            questions: [
                "Ton moment fort de cette année ?",
                "Ta plus grande fierté ?",
                "Ce que tu veux laisser derrière toi ?",
                "Ton objectif pour l'année prochaine ?",
                "Un message pour toi du futur ?",
                "Qu'est-ce qui t'a le plus marqué ?",
                "Une leçon apprise cette année ?",
                "Comment te sens-tu aujourd'hui ?"
            ]
        },
        {
            id: 'noel',
            name: 'Noël',
            emoji: '🎄',
            color: 'from-red-400 to-green-500',
            hoverColor: 'hover:from-red-500 hover:to-green-600',
            questions: [
                "Ton meilleur souvenir de Noël ?",
                "Qu'est-ce que Noël signifie pour toi ?",
                "Ton plat préféré des fêtes ?",
                "Un vœu pour l'année qui vient ?",
                "La meilleure tradition de Noël ?",
                "Que souhaites-tu offrir cette année ?",
                "Raconte une anecdote de Noël drôle !",
                "Un message de bonheur pour tous ?"
            ]
        },
        {
            id: 'teambuild',
            name: 'Team Building',
            emoji: '🎯',
            color: 'from-cyan-400 to-blue-500',
            hoverColor: 'hover:from-cyan-500 hover:to-blue-600',
            questions: [
                "Quel est ton super-pouvoir dans l'équipe ?",
                "Qui t'inspire dans le groupe ?",
                "Ton moment wow aujourd'hui ?",
                "Une chose que tu as apprise sur toi ?",
                "Comment décrirais-tu l'esprit d'équipe ?",
                "Ton défi relevé aujourd'hui ?",
                "Un compliment pour un collègue ?",
                "Ce que tu retiens de cette expérience ?"
            ]
        },
        {
            id: 'remerciements',
            name: 'Remerciements',
            emoji: '🙏',
            color: 'from-amber-400 to-yellow-500',
            hoverColor: 'hover:from-amber-500 hover:to-yellow-600',
            questions: [
                "Qui veux-tu remercier et pourquoi ?",
                "Un moment où quelqu'un t'a aidé ?",
                "Une personne qui t'inspire ?",
                "Un geste qui t'a touché ?",
                "Ce pour quoi tu es reconnaissant ?",
                "Un message de gratitude à partager ?",
                "Qui a fait une différence pour toi ?",
                "Un merci que tu veux dire à haute voix ?"
            ]
        }
    ];

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


    // Auto-generate slug from name with unique ID
    const handleNameChange = (value: string) => {
        setName(value);
        const baseSlug = value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with -
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing -

        // Add timestamp + random ID to ensure absolute uniqueness
        const timestamp = Date.now().toString(36);
        const randomId = Math.random().toString(36).substring(2, 6);
        const uniqueId = `${timestamp}${randomId}`;
        const generatedSlug = baseSlug ? `${baseSlug}-${uniqueId}` : uniqueId;
        setSlug(generatedSlug);
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBackgroundImage(file);
            // Upload immediately
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

    // AI Question Generation functions
    const generateQuestions = async (categoryPrompt?: string) => {
        const promptToUse = categoryPrompt || companyContext.trim();
        
        if (!promptToUse) {
            setAiError('Veuillez fournir un contexte ou choisir une catégorie');
            return;
        }

        setIsGenerating(true);
        setAiError('');
        setGeneratedQuestions([]);
        setSelectedQuestions(new Set());

        try {
            const response = await fetch('/api/generate-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyContext: promptToUse }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la génération');
            }

            setGeneratedQuestions(data.questions);
            // Auto-select all generated questions
            setSelectedQuestions(new Set(data.questions.map((_: string, i: number) => i)));
        } catch (err) {
            setAiError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setIsGenerating(false);
        }
    };

    const generateQuestionsFromCategory = (categoryId: string) => {
        const category = categoryTemplates.find(c => c.id === categoryId);
        if (category) {
            generateQuestions(category.prompt);
        }
    };

    const addEventTemplateQuestions = (eventId: string) => {
        const event = eventTemplates.find(e => e.id === eventId);
        if (!event) return;

        const questionsToAdd = event.questions.map(text => ({
            id: Date.now().toString() + Math.random(),
            text
        }));

        // Remove empty questions and add event template questions
        const nonEmptyQuestions = questions.filter(q => q.text.trim());
        setQuestions([...nonEmptyQuestions, ...questionsToAdd]);
    };

    const toggleQuestionSelection = (index: number) => {
        const newSelected = new Set(selectedQuestions);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedQuestions(newSelected);
    };

    const addSelectedQuestions = () => {
        const questionsToAdd = Array.from(selectedQuestions)
            .map(index => generatedQuestions[index])
            .filter(q => q && q.trim())
            .map(text => ({
                id: Date.now().toString() + Math.random(),
                text
            }));

        if (questionsToAdd.length > 0) {
            // Remove empty questions and add AI-generated ones
            const nonEmptyQuestions = questions.filter(q => q.text.trim());
            setQuestions([...nonEmptyQuestions, ...questionsToAdd]);

            // Clear AI generation state
            setGeneratedQuestions([]);
            setSelectedQuestions(new Set());
            setCompanyContext('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setError('');
        setLoading(true);

        try {
            // 1. Create project
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .insert({
                    user_id: user.id,
                    name,
                    slug,
                    response_duration: responseDuration,
                    background_image_url: backgroundImageUrl,
                    is_active: true,
                })
                .select()
                .single();

            if (projectError) throw projectError;

            // 2. Create questions
            const questionsToInsert = questions
                .filter((q) => q.text.trim() !== '')
                .map((q, index) => ({
                    project_id: project.id,
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
            router.push(`/dashboard/projects/${project.id}`);
        } catch (err) {
            console.error('Project creation error:', err);
            if (err instanceof Error) {
                // Display detailed error message
                const errorMessage = err.message;
                if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
                    setError(`Conflit détecté : Un projet avec ce slug existe déjà. Veuillez modifier le slug ou recharger la page. Détails: ${errorMessage}`);
                } else {
                    setError(`Erreur: ${errorMessage}`);
                }
            } else {
                setError('Une erreur est survenue lors de la création du projet');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Link href="/dashboard" className="hover:text-[#7C4DFF]">Dashboard</Link>
                    <span>&gt;</span>
                    <Link href="/dashboard/projects" className="hover:text-[#7C4DFF]">Projets</Link>
                    <span>&gt;</span>
                    <span className="text-gray-800 font-medium">Nouveau</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-800">Nouveau Projet</h1>
                <p className="text-gray-500">Créez un projet d'enregistrement vidéo personnalisé</p>
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
                                onChange={(e) => handleNameChange(e.target.value)}
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

                {/* AI Question Generation */}
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-sm p-6 border border-purple-100">
                    <div className="flex items-center gap-2 mb-4">
                       
                        <h2 className="text-lg font-bold text-gray-800">Générer des questions automatiquement</h2>
                    </div>
                    
                    {/* Explanation Box */}
                    <div className="bg-white rounded-xl p-5 mb-6 border-2 border-purple-200 shadow-sm">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 mb-2"> Trois façons de créer vos questions</h3>
                                <p className="text-sm text-gray-600 mb-3">Choisissez la méthode qui correspond le mieux à votre événement :</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* Option 1 */}
                            <div className="flex items-start gap-3 bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg p-3 border border-rose-200">
                                <div className="flex-shrink-0 w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    1
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 text-sm mb-1"> Templates Événementiels</h4>
                                    <p className="text-xs text-gray-700">
                                        <strong>Questions pré-écrites</strong> pour événements courants (mariage, anniversaire, entreprise...). 
                                        <span className="text-rose-600 font-medium"> Instantané, aucune IA requise.</span>
                                    </p>
                                </div>
                            </div>

                            {/* Option 2 */}
                            <div className="flex items-start gap-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-3 border border-purple-200">
                                <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    2
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 text-sm mb-1"> Actions Rapides (IA)</h4>
                                    <p className="text-xs text-gray-700">
                                        <strong>Génération par catégorie</strong> (fun, grimaces, danse...). 
                                        <span className="text-purple-600 font-medium"> L'IA crée 8 instructions d'actions originales.</span>
                                    </p>
                                </div>
                            </div>

                            {/* Option 3 */}
                            <div className="flex items-start gap-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-200">
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    3
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 text-sm mb-1"> Contexte Personnalisé (IA)</h4>
                                    <p className="text-xs text-gray-700">
                                        <strong>Décrivez votre entreprise/événement</strong> et l'IA génère des questions 100% adaptées. 
                                        <span className="text-blue-600 font-medium"> Idéal pour les entreprises.</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Pro Tip */}
                        <div className="mt-4 pt-3 border-t border-purple-200">
                            <div className="flex items-start gap-2">
                                <span className="text-lg">💡</span>
                                <p className="text-xs text-gray-600">
                                    <strong>Astuce :</strong> Vous pouvez combiner les trois méthodes ! Par exemple : utilisez un template événementiel puis ajoutez des questions personnalisées générées par IA.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Event Templates - NEW SECTION */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                        1
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700">
                                             Templates Événementiels
                                        </label>
                                        <p className="text-xs text-gray-500">Questions pré-écrites • Ajout instantané</p>
                                    </div>
                                </div>
                                <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs font-medium rounded-full">
                                    8 questions chacun
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {eventTemplates.map((event) => (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => addEventTemplateQuestions(event.id)}
                                        className={`group relative px-3 py-3 bg-gradient-to-br ${event.color} ${event.hoverColor} text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-2xl">{event.emoji}</span>
                                            <span className="text-xs text-center leading-tight">{event.name}</span>
                                        </div>
                                        {/* Tooltip on hover */}
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                            {event.questions.length} questions prêtes
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-3 bg-gradient-to-br from-purple-50 to-blue-50 text-gray-500 font-medium">ou</span>
                            </div>
                        </div>

                        {/* Category Buttons - EXISTING */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                        2
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700">
                                             Actions Rapides avec IA
                                        </label>
                                        <p className="text-xs text-gray-500">Génération automatique par catégorie</p>
                                    </div>
                                </div>
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                    Génère 8 actions
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {categoryTemplates.map((category) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => generateQuestionsFromCategory(category.id)}
                                        disabled={isGenerating}
                                        className={`group relative px-4 py-3 bg-gradient-to-br ${category.color} ${category.hoverColor} text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-2xl">{category.emoji}</span>
                                            <span className="text-xs">{category.name}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-3 bg-gradient-to-br from-purple-50 to-blue-50 text-gray-500 font-medium">ou</span>
                            </div>
                        </div>

                        {/* Custom Context Section */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    3
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700">
                                         Contexte Personnalisé (IA)
                                    </label>
                                    <p className="text-xs text-gray-500">Décrivez votre événement ou entreprise</p>
                                </div>
                            </div>
                            <textarea
                                value={companyContext}
                                onChange={(e) => setCompanyContext(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent transition resize-none"
                                placeholder="Ex: Entreprise tech innovante spécialisée dans l'IA, valeurs: innovation, collaboration..."
                                disabled={isGenerating}
                            />
                        </div>

                        {aiError && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                                <p className="text-red-600 text-sm font-medium">{aiError}</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => generateQuestions()}
                                disabled={isGenerating || !companyContext.trim()}
                                className="flex-1 px-4 py-2 bg-[#7C4DFF] hover:bg-[#6c42e0] text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-200 flex items-center justify-center gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Génération en cours...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        {generatedQuestions.length > 0 ? 'Régénérer' : 'Générer avec mon contexte'}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Generated Questions Display */}
                        {generatedQuestions.length > 0 && (
                            <div className="mt-6 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-700">Questions générées ({generatedQuestions.length})</h3>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const allSelected = selectedQuestions.size === generatedQuestions.length;
                                            if (allSelected) {
                                                setSelectedQuestions(new Set());
                                            } else {
                                                setSelectedQuestions(new Set(generatedQuestions.map((_, i) => i)));
                                            }
                                        }}
                                        className="text-xs text-[#7C4DFF] hover:text-[#6c42e0] font-medium"
                                    >
                                        {selectedQuestions.size === generatedQuestions.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {generatedQuestions.map((question, index) => (
                                        <label
                                            key={index}
                                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${selectedQuestions.has(index)
                                                ? 'bg-purple-50 border-[#7C4DFF]'
                                                : 'bg-white border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedQuestions.has(index)}
                                                onChange={() => toggleQuestionSelection(index)}
                                                className="mt-1 w-4 h-4 text-[#7C4DFF] border-gray-300 rounded focus:ring-[#7C4DFF]"
                                            />
                                            <span className="flex-1 text-sm text-gray-700">{question}</span>
                                        </label>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={addSelectedQuestions}
                                    disabled={selectedQuestions.size === 0}
                                    className="w-full px-4 py-2 bg-[#00BFA5] hover:bg-[#008f7a] text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    Ajouter {selectedQuestions.size} question{selectedQuestions.size > 1 ? 's' : ''} sélectionnée{selectedQuestions.size > 1 ? 's' : ''}
                                </button>
                            </div>
                        )}
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
                        {loading ? 'Création en cours...' : 'Créer le projet'}
                    </button>
                    <Link
                        href="/dashboard/projects"
                        className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Annuler
                    </Link>
                </div>
                </div>

                {/* Tips & Examples Sidebar - Right Side (1/3) */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Templates Événementiels - NEW */}
                    <div className="bg-gradient-to-br from-rose-50 to-pink-100 rounded-lg p-5 border border-rose-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-rose-500 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-rose-900">🎉 Nouveauté !</h3>
                        </div>
                        <div className="space-y-3">
                            <p className="text-sm text-rose-800 font-semibold">Templates Événementiels</p>
                            <ul className="space-y-2 text-sm text-rose-800">
                                <li className="flex items-start gap-2">
                                    <span className="text-rose-500 mt-0.5">💒</span>
                                    <span><strong>Mariage</strong> - Questions pour immortaliser ce jour unique</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-rose-500 mt-0.5">🎂</span>
                                    <span><strong>Anniversaire</strong> - Messages personnalisés pour la fête</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-rose-500 mt-0.5">🏢</span>
                                    <span><strong>Entreprise</strong> - Cohésion d'équipe et témoignages</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-rose-500 mt-0.5">🎄</span>
                                    <span><strong>Noël</strong> - Esprit des fêtes et traditions</span>
                                </li>
                            </ul>
                            <div className="bg-white/60 rounded-lg p-3 mt-3">
                                <p className="text-xs text-rose-700">
                                    <strong>💡 Astuce :</strong> Cliquez sur un template pour ajouter instantanément 8 questions prêtes à l'emploi !
                                </p>
                            </div>
                        </div>
                    </div>

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
