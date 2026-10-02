'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const router = useRouter();
    const [isSignUp, setIsSignUp] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const configured = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );

    useEffect(() => {
        if (!configured) return;
        let active = true;
        void createClient().auth.getUser().then(({ data: { user } }) => {
            if (active && user) router.replace('/welcome');
        });
        return () => { active = false; };
    }, [configured, router]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPending(true);
        setError('');
        setNotice('');

        const client = createClient();
        const result = isSignUp
            ? await client.auth.signUp({
                email: email.trim(),
                password,
                options: { data: { display_name: displayName.trim() } },
            })
            : await client.auth.signInWithPassword({ email: email.trim(), password });

        setPending(false);
        if (result.error) {
            setError(result.error.message);
            return;
        }
        if (isSignUp && !result.data.session) {
            setNotice('Compte créé. Consulte ta boîte mail pour confirmer ton adresse avant de te connecter.');
            return;
        }
        router.replace('/welcome');
    };

    return (
        <main className="min-h-screen bg-[#021002] px-5 py-12 font-mono text-[#00ff66] flex items-center justify-center relative overflow-hidden">
            <div className="pointer-events-none fixed inset-0 opacity-30 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.45)_50%)] bg-size-[100%_4px]" />
            <section className="relative w-full max-w-md border-2 border-[#00ff66] bg-[#011801] p-6 shadow-[0_0_30px_rgba(0,255,102,0.18)] sm:p-8">
                <p className="mb-2 text-xs tracking-[0.2em] text-[#00ff66]/65">KURO STUDIO // AUTH</p>
                <h1 className="mb-7 text-xl font-bold tracking-widest">{isSignUp ? 'CRÉER UN COMPTE' : 'ACCÈS AU TERMINAL'}</h1>

                {!configured ? (
                    <SetupInstructions />
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <label className="block space-y-1.5 text-xs">
                                <span>NOM D’AFFICHAGE</span>
                                <input
                                    autoComplete="name"
                                    value={displayName}
                                    onChange={event => setDisplayName(event.target.value)}
                                    required
                                    maxLength={80}
                                    className="w-full border border-[#00ff66]/60 bg-black px-3 py-2.5 text-sm outline-none focus:border-[#00ff66]"
                                />
                            </label>
                        )}
                        <label className="block space-y-1.5 text-xs">
                            <span>ADRESSE E-MAIL</span>
                            <input
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={event => setEmail(event.target.value)}
                                required
                                className="w-full border border-[#00ff66]/60 bg-black px-3 py-2.5 text-sm outline-none focus:border-[#00ff66]"
                            />
                        </label>
                        <label className="block space-y-1.5 text-xs">
                            <span>MOT DE PASSE</span>
                            <input
                                type="password"
                                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                value={password}
                                onChange={event => setPassword(event.target.value)}
                                required
                                minLength={8}
                                className="w-full border border-[#00ff66]/60 bg-black px-3 py-2.5 text-sm outline-none focus:border-[#00ff66]"
                            />
                        </label>
                        {error && <p role="alert" className="border border-[#ff5555] p-2.5 text-xs text-[#ff8888]">{error}</p>}
                        {notice && <p role="status" className="border border-[#00ff66]/50 p-2.5 text-xs">{notice}</p>}
                        <button
                            type="submit"
                            disabled={pending}
                            className="w-full border-2 border-[#00ff66] bg-[#012601] px-4 py-3 text-xs font-bold tracking-widest hover:bg-[#00ff66] hover:text-black disabled:cursor-wait disabled:opacity-60"
                        >
                            {pending ? 'TRANSMISSION...' : isSignUp ? 'CRÉER LE COMPTE' : 'SE CONNECTER'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsSignUp(value => !value); setError(''); setNotice(''); }}
                            className="w-full py-2 text-xs text-[#00ff66]/75 underline underline-offset-4 hover:text-[#00ff66]"
                        >
                            {isSignUp ? 'J’ai déjà un compte' : 'Créer un compte'}
                        </button>
                    </form>
                )}
            </section>
        </main>
    );
}

function SetupInstructions() {
    return (
        <div className="space-y-3 border border-[#00ff66]/40 bg-black/50 p-4 text-xs leading-6">
            <p>La connexion Supabase n’est pas encore configurée.</p>
            <p>Copie `.env.example` vers `.env.local`, puis renseigne l’URL et la clé publique de ton projet Supabase.</p>
            <p>Exécute ensuite `supabase/schema.sql` dans le SQL Editor de Supabase et redémarre le serveur.</p>
        </div>
    );
}