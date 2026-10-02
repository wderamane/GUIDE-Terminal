'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function WelcomePage() {
    const router = useRouter();
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const loadWelcome = async () => {
            const client = createClient();
            const { data: { user }, error: authError } = await client.auth.getUser();

            if (!active) return;
            if (authError || !user) {
                router.replace('/login');
                return;
            }

            const { data: profile } = await client
                .from('profiles')
                .select('display_name')
                .eq('id', user.id)
                .maybeSingle();

            if (!active) return;
            const name = profile?.display_name?.trim()
                || user.user_metadata.display_name?.trim()
                || user.email?.split('@')[0]
                || 'utilisateur';
            setDisplayName(name);
            setLoading(false);
        };

        void loadWelcome();
        return () => { active = false; };
    }, [router]);

    if (loading) {
        return <main className="min-h-screen bg-[#021002] p-8 font-mono text-[#00ff66]">Initialisation du profil...</main>;
    }

    return (
        <main className="min-h-screen overflow-hidden bg-[#021002] px-5 py-12 font-mono text-[#00ff66] flex items-center justify-center relative">
            <div className="pointer-events-none fixed inset-0 opacity-30 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.45)_50%)] bg-size-[100%_4px]" />
            <section className="relative w-full max-w-2xl border-2 border-[#00ff66] bg-[#011801] p-7 shadow-[0_0_32px_rgba(0,255,102,0.2)] sm:p-10">
                <p className="mb-3 text-xs tracking-[0.2em] text-[#00ff66]/65">KURO STUDIO // G.U.I.D.E</p>
                <h1 className="mb-3 wrap-break-word text-2xl font-bold sm:text-3xl">BIENVENUE, {displayName.toLocaleUpperCase('fr')}</h1>
                <p className="mb-8 text-sm text-[#00ff66]/75">Ton espace de travail est prêt.</p>
                <button
                    type="button"
                    onClick={() => router.replace('/')}
                    className="border-2 border-[#00ff66] bg-[#012601] px-5 py-3 text-xs font-bold tracking-widest hover:bg-[#00ff66] hover:text-black"
                >
                    ENTRER DANS LE CHAT
                </button>
            </section>
        </main>
    );
}