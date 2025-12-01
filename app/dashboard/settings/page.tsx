'use client';

import { useEffect, useState } from 'react';
import { supabase, type Profile } from '@/lib/supabase';
import { useAuth } from '@/app/components/AuthProvider';

export default function SettingsPage() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [fullName, setFullName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user!.id)
                .single();

            if (error) {
                // Ignore "Row not found" error (code PGRST116) as it just means profile doesn't exist yet
                if (error.code === 'PGRST116') {
                    return;
                }
                throw error;
            }

            if (data) {
                setProfile(data);
                setFullName(data.full_name || '');
                setCompanyName(data.company_name || '');
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        try {
            // Check if profile exists first
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user!.id)
                .single();

            let error;

            if (existingProfile) {
                // Update
                const result = await supabase
                    .from('profiles')
                    .update({
                        full_name: fullName,
                        company_name: companyName,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', user!.id);
                error = result.error;
            } else {
                // Insert - include email from auth user
                const result = await supabase
                    .from('profiles')
                    .insert({
                        id: user!.id,
                        email: user!.email!,
                        full_name: fullName,
                        company_name: companyName,
                    });
                error = result.error;
            }

            if (error) throw error;
            setMessage('Profil mis à jour avec succès !');
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage('Erreur lors de la mise à jour.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-[#00BFA5] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Paramètres du compte</h1>
                <p className="text-gray-500">Gérez vos informations personnelles</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-100">
                {message && (
                    <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${message.includes('succès') ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSave} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={user?.email}
                            disabled
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-400">L'email ne peut pas être modifié</p>
                    </div>

                    <div>
                        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                            Nom complet
                        </label>
                        <input
                            id="fullName"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent transition"
                        />
                    </div>

                    <div>
                        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                            Nom de l'entreprise
                        </label>
                        <input
                            id="companyName"
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C4DFF] focus:border-transparent transition"
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-[#7C4DFF] hover:bg-[#6c42e0] text-white font-bold py-2.5 px-4 rounded-lg transition disabled:opacity-50 shadow-md shadow-purple-200"
                        >
                            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
