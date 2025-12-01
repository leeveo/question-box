'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setShowErrorModal(false);
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                router.push('/dashboard');
            }
        } catch (err) {
            // Afficher un message d'erreur convivial dans le modal
            if (err instanceof Error) {
                if (err.message.includes('Invalid login credentials')) {
                    setError('Identifiants incorrects. Veuillez vérifier votre email et mot de passe.');
                } else if (err.message.includes('Email not confirmed')) {
                    setError('Veuillez confirmer votre email avant de vous connecter.');
                } else {
                    setError('Une erreur est survenue lors de la connexion. Veuillez réessayer.');
                }
            } else {
                setError('Une erreur est survenue lors de la connexion.');
            }
            setShowErrorModal(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-[#F3F4F6]">
            {/* Left Column - Violet (1/3) */}
            <div className="hidden lg:flex lg:w-1/3 bg-[#7C4DFF] relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
                
                <div className="relative z-10 flex flex-col justify-center px-12 text-white">
                    {/* Logo */}
                    <div className="flex justify-center mb-8">
                        <img src="/logo.png" alt="Waibox Logo" className="h-24 w-24 drop-shadow-2xl" />
                    </div>

                    <h1 className="text-5xl font-bold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-pink-100">
                        Waibox
                    </h1>
                    <p className="text-xl text-white/90 mb-10 text-center leading-relaxed font-light">
                        Créez des interviews vidéo extraordinaires en quelques clics
                    </p>

                    <div className="space-y-4">
                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 p-5 hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105">
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative">
                                <h3 className="text-white font-bold text-xl mb-1 bg-clip-text text-transparent bg-gradient-to-r from-cyan-200 to-white">
                                    Enregistrement HD
                                </h3>
                                <p className="text-purple-100/80 text-sm">
                                    Qualité cinéma garantie pour vos interviews
                                </p>
                            </div>
                        </div>

                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 p-5 hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105">
                            <div className="absolute inset-0 bg-gradient-to-br from-pink-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative">
                                <h3 className="text-white font-bold text-xl mb-1 bg-clip-text text-transparent bg-gradient-to-r from-pink-200 to-white">
                                    Multi-projets
                                </h3>
                                <p className="text-purple-100/80 text-sm">
                                    Organisez tous vos projets en un seul endroit
                                </p>
                            </div>
                        </div>

                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 p-5 hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative">
                                <h3 className="text-white font-bold text-xl mb-1 bg-clip-text text-transparent bg-gradient-to-r from-emerald-200 to-white">
                                    Ultra-sécurisé
                                </h3>
                                <p className="text-purple-100/80 text-sm">
                                    Vos données protégées avec cryptage de bout en bout
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column - Login Form (2/3) */}
            <div className="w-full lg:w-2/3 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="text-center mb-8 lg:hidden">
                        <div className="flex justify-center mb-4">
                            <img src="/logo.png" alt="Waibox Logo" className="h-20 w-20 drop-shadow-lg" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Waibox</h1>
                        <p className="text-gray-500">Connectez-vous à votre compte</p>
                    </div>

                    {/* Login Form Card */}
                    <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Connexion</h2>

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    Email
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                        </svg>
                                    </div>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent transition"
                                        placeholder="votre@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                    Mot de passe
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-12 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent transition"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                                    >
                                        {showPassword ? (
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#7C4DFF] hover:bg-[#6c42e0] text-white font-bold py-3 px-4 rounded-lg shadow-md shadow-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Connexion en cours...
                                    </span>
                                ) : 'Se connecter'}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-gray-600 text-sm">
                                Pas encore de compte ?{' '}
                                <Link href="/signup" className="text-[#00BFA5] hover:text-[#008f7a] font-medium transition-colors">
                                    Créer un compte
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Modal Popup */}
            {showErrorModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-scaleIn">
                        {/* Header with Icon */}
                        <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-t-2xl p-6 text-center">
                            <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-lg">
                                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-white">Erreur de connexion</h3>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            <p className="text-gray-700 text-center text-base leading-relaxed mb-6">
                                {error}
                            </p>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowErrorModal(false)}
                                    className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                                >
                                    Réessayer
                                </button>
                                <Link
                                    href="/signup"
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-center"
                                >
                                    Créer un compte
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add animations */}
            <style jsx>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                @keyframes blob {
                    0% {
                        transform: translate(0px, 0px) scale(1);
                    }
                    33% {
                        transform: translate(30px, -50px) scale(1.1);
                    }
                    66% {
                        transform: translate(-20px, 20px) scale(0.9);
                    }
                    100% {
                        transform: translate(0px, 0px) scale(1);
                    }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
                .animate-scaleIn {
                    animation: scaleIn 0.3s ease-out;
                }
                .animate-blob {
                    animation: blob 7s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
            `}</style>
        </div>
    );
}
