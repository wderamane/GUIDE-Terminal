'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface AccountDetails {
    displayName: string;
    email: string;
    role: 'user' | 'admin';
}

export default function AccountPage() {
    const router = useRouter();
    const [account, setAccount] = useState<AccountDetails | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const loadAccount = async () => {
            const client = createClient();
            const { data: { user }, error: authError } = await client.auth.getUser();

            if (!active) return;
            if (authError || !user) {
                router.replace('/login');
                return;
            }

            const { data: profile, error: profileError } = await client
                .from('profiles')
                .select('display_name, role')
                .eq('id', user.id)
                .maybeSingle();

            if (!active) return;
            if (profileError) {
                setError('Impossible de charger les informations du compte.');
            } else {
                setAccount({
                    displayName: profile?.display_name?.trim() || user.user_metadata.display_name?.trim() || 'Non renseigné',
                    email: user.email ?? 'Non renseigné',
                    role: profile?.role === 'admin' ? 'admin' : 'user',
                });
            }
            setLoading(false);
        };

        void loadAccount();
        return () => { active = false; };
    }, [router]);

    const signOut = async () => {
        await createClient().auth.signOut();
        router.replace('/login');
    };

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#021002] px-5 py-12 font-mono text-[#00ff66]">
            <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.45)_50%)] bg-size-[100%_4px] opacity-30" />
            <section className="relative w-full max-w-xl border-2 border-[#00ff66] bg-[#011801] p-6 shadow-[0_0_30px_rgba(0,255,102,0.18)] sm:p-8">
                <p className="mb-2 text-xs tracking-[0.2em] text-[#00ff66]/65">KURO STUDIO // PROFIL</p>
                <h1 className="mb-7 text-xl font-bold tracking-widest">MON COMPTE</h1>

                {loading ? (
                    <p className="text-sm">Chargement du compte...</p>
                ) : error ? (
                    <p role="alert" className="border border-[#ff5555] p-3 text-sm text-[#ff8888]">{error}</p>
                ) : account ? (
                    <dl className="divide-y divide-[#00ff66]/25 border-y border-[#00ff66]/40">
                        <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-4">
                            <dt className="text-xs text-[#00ff66]/65">NOM D’AFFICHAGE</dt>
                            <dd className="wrap-break-word text-sm font-bold">{account.displayName}</dd>
                        </div>
                        <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-4">
                            <dt className="text-xs text-[#00ff66]/65">ADRESSE E-MAIL</dt>
                            <dd className="wrap-break-word text-sm">{account.email}</dd>
                        </div>
                        <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-4">
                            <dt className="text-xs text-[#00ff66]/65">RÔLE</dt>
                            <dd><span className="inline-block border border-[#00ff66] px-2 py-1 text-xs font-bold">{account.role === 'admin' ? 'ADMINISTRATEUR' : 'UTILISATEUR'}</span></dd>
                        </div>
                    </dl>
                ) : null}

                <div className="mt-7 flex flex-wrap gap-3">
                    <button onClick={() => router.push('/')} className="border-2 border-[#00ff66] bg-[#012601] px-4 py-3 text-xs font-bold tracking-widest hover:bg-[#00ff66] hover:text-black">
                        RETOUR AU CHAT
                    </button>
                    <button onClick={signOut} className="border border-[#00ff66]/60 px-4 py-3 text-xs hover:bg-[#00ff66]/15">
                        SE DÉCONNECTER
                    </button>
                </div>
            </section>
        </main>
    );
}