'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Task {
    id: string;
    text: string;
    completed: boolean;
}

function SetupNotice() {
    return (
        <main className="min-h-screen bg-[#021002] p-6 font-mono text-[#00ff66] flex items-center justify-center">
            <section className="max-w-xl border-2 border-[#00ff66] bg-[#011801] p-6 shadow-[0_0_30px_rgba(0,255,102,0.18)]">
                <p className="mb-2 text-xs tracking-widest text-[#00ff66]/65">KURO STUDIO // SETUP</p>
                <h1 className="mb-4 text-lg font-bold">Connexion à la base de données requise</h1>
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
                    <li>Crée un projet Supabase et copie `.env.example` vers `.env.local`.</li>
                    <li>Renseigne l’URL du projet et sa clé publique Supabase.</li>
                    <li>Exécute `supabase/schema.sql` dans le SQL Editor, puis redémarre le serveur.</li>
                </ol>
                <a className="mt-5 inline-block border border-[#00ff66] px-3 py-2 text-xs hover:bg-[#00ff66] hover:text-black" href="https://supabase.com/dashboard">
                    OUVRIR SUPABASE
                </a>
            </section>
        </main>
    );
}

interface Snippet {
    id: string;
    title: string;
    code: string;
}

interface Message {
    id: string;
    sender: 'user' | 'guide';
    text: string;
}

interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
}

interface PendingAction {
    id: string;
    name: 'write_local_file' | 'run_local_command';
    arguments: Record<string, unknown>;
}

export default function GuideTerminalDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'terminal' | 'tasks' | 'snippets'>('terminal');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTaskText, setNewTaskText] = useState('');
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [newSnippetTitle, setNewSnippetTitle] = useState('');
    const [newSnippetCode, setNewSnippetCode] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [lastTokenUsage, setLastTokenUsage] = useState<TokenUsage | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [approvingAction, setApprovingAction] = useState(false);
    const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
    const [authReady, setAuthReady] = useState(() => !(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ));
    const [appError, setAppError] = useState('');
    const logEndRef = useRef<HTMLDivElement>(null);
    const supabaseConfigured = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );

    useEffect(() => {
        if (!supabaseConfigured) {
            return;
        }

        let active = true;
        const loadDashboard = async () => {
            const client = createClient();
            const { data: { user }, error: authError } = await client.auth.getUser();

            if (!active) return;
            if (authError || !user) {
                router.replace('/login');
                return;
            }

            const [taskResult, snippetResult, messageResult, profileResult] = await Promise.all([
                client.from('tasks').select('id, text, completed').order('created_at'),
                client.from('snippets').select('id, title, code').order('created_at'),
                client.from('messages').select('id, sender, text').order('created_at'),
                client.from('profiles').select('role').eq('id', user.id).single(),
            ]);

            if (!active) return;
            const loadError = taskResult.error ?? snippetResult.error ?? messageResult.error ?? profileResult.error;
            if (loadError || !profileResult.data) {
                setAppError(`Chargement impossible : ${loadError?.message ?? 'profil utilisateur introuvable'}`);
            } else {
                setUserRole(profileResult.data.role);
                setTasks(taskResult.data ?? []);
                setSnippets(snippetResult.data ?? []);
                if (!messageResult.data?.length) {
                    const { data: welcomeMessage } = await client
                        .from('messages')
                        .insert({ sender: 'guide', text: 'Systèmes de Kuro Studio initialisés. Prêt à travailler, chef.' })
                        .select('id, sender, text')
                        .single();
                    if (welcomeMessage) setMessages([welcomeMessage as Message]);
                } else {
                    setMessages(messageResult.data as Message[]);
                }
            }
            setAuthReady(true);
        };

        void loadDashboard();
        return () => { active = false; };
    }, [router, supabaseConfigured]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const addTask = async (e: FormEvent) => {
        e.preventDefault();
        const text = newTaskText.trim();
        if (!text) return;
        const { data, error } = await createClient()
            .from('tasks')
            .insert({ text, completed: false })
            .select('id, text, completed')
            .single();
        if (error) {
            setAppError(`Enregistrement impossible : ${error.message}`);
            return;
        }
        setAppError('');
        setTasks(current => [...current, data]);
        setNewTaskText('');
    };

    const toggleTask = async (task: Task) => {
        const { error } = await createClient()
            .from('tasks')
            .update({ completed: !task.completed })
            .eq('id', task.id);
        if (error) {
            setAppError(`Modification impossible : ${error.message}`);
            return;
        }
        setAppError('');
        setTasks(current => current.map(item => item.id === task.id ? { ...item, completed: !task.completed } : item));
    };

    const deleteTask = async (id: string) => {
        const { error } = await createClient().from('tasks').delete().eq('id', id);
        if (error) {
            setAppError(`Suppression impossible : ${error.message}`);
            return;
        }
        setAppError('');
        setTasks(current => current.filter(task => task.id !== id));
    };

    const addSnippet = async (e: FormEvent) => {
        e.preventDefault();
        const title = newSnippetTitle.trim();
        const code = newSnippetCode.trim();
        if (!title || !code) return;
        const { data, error } = await createClient()
            .from('snippets')
            .insert({ title, code })
            .select('id, title, code')
            .single();
        if (error) {
            setAppError(`Archivage impossible : ${error.message}`);
            return;
        }
        setAppError('');
        setSnippets(current => [...current, data]);
        setNewSnippetTitle('');
        setNewSnippetCode('');
    };

    const handleChatSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const userMsg = chatInput.trim();
        if (!userMsg || sendingMessage) return;
        const isLocalCommand = userMsg.startsWith('!');
        const directCommand = isLocalCommand ? userMsg.slice(1).trim() : undefined;
        if (isLocalCommand && (!directCommand || directCommand.length > 1000)) {
            setAppError('Après !, écris une commande PowerShell de 1 à 1000 caractères.');
            return;
        }

        setChatInput('');
        setSendingMessage(true);
        setLastTokenUsage(null);
        const client = createClient();
        const { data: savedUserMessage, error: userMessageError } = await client
            .from('messages')
            .insert({ sender: 'user', text: userMsg })
            .select('id, sender, text')
            .single();

        if (userMessageError) {
            setAppError(`Message non enregistré : ${userMessageError.message}`);
            setChatInput(userMsg);
            setSendingMessage(false);
            return;
        }
        setMessages(current => [...current, savedUserMessage as Message]);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, ...(directCommand ? { directCommand } : {}) }),
            });
            const payload = await response.json() as {
                text?: unknown;
                error?: unknown;
                usage?: TokenUsage;
                pendingAction?: PendingAction;
            };

            if (!response.ok || typeof payload.text !== 'string') {
                setAppError(typeof payload.error === 'string' ? payload.error : 'G.U.I.D.E n’a pas pu répondre. Réessaie.');
                return;
            }

            const { data: savedGuideMessage, error: guideMessageError } = await client
                .from('messages')
                .insert({ sender: 'guide', text: payload.text })
                .select('id, sender, text')
                .single();
            if (guideMessageError) {
                setAppError(`Réponse reçue, mais non enregistrée : ${guideMessageError.message}`);
                return;
            }

            setMessages(current => [...current, savedGuideMessage as Message]);
            setLastTokenUsage(payload.usage ?? null);
            setPendingAction(payload.pendingAction ?? null);
            setAppError('');
        } catch {
            setAppError('Impossible de contacter G.U.I.D.E. Vérifie les services locaux puis réessaie.');
        } finally {
            setSendingMessage(false);
        }
    };

    const resolvePendingAction = async (approved: boolean) => {
        if (!pendingAction || approvingAction) return;
        const approvalId = pendingAction.id;
        setPendingAction(null);
        setApprovingAction(true);
        setSendingMessage(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approvalId, approved }),
            });
            const payload = await response.json() as {
                text?: unknown;
                error?: unknown;
                usage?: TokenUsage;
            };
            if (!response.ok || typeof payload.text !== 'string') {
                setAppError(typeof payload.error === 'string' ? payload.error : 'La confirmation n’a pas abouti.');
                return;
            }

            const { data: savedGuideMessage, error: guideMessageError } = await createClient()
                .from('messages')
                .insert({ sender: 'guide', text: payload.text })
                .select('id, sender, text')
                .single();
            if (guideMessageError) {
                setAppError(`Résultat reçu, mais non enregistré : ${guideMessageError.message}`);
                return;
            }

            setMessages(current => [...current, savedGuideMessage as Message]);
            setLastTokenUsage(payload.usage ?? null);
            setAppError('');
        } catch {
            setAppError('Impossible de joindre le compagnon local. Vérifie ses services puis réessaie.');
        } finally {
            setApprovingAction(false);
            setSendingMessage(false);
        }
    };

    const signOut = async () => {
        await createClient().auth.signOut();
        router.replace('/login');
    };

    if (!supabaseConfigured) return <SetupNotice />;
    if (!authReady) return <div className="min-h-screen bg-[#021002] p-8 font-mono text-[#00ff66]">Connexion au terminal...</div>;

    return (
        <main className="min-h-screen bg-[#021002] text-[#00ff66] font-mono p-4 flex flex-col justify-center items-center box-border select-none relative overflow-hidden">
            
            {/* Effet d'écran cathodique / CRT balayage */}
            <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(0,255,102,0.03),rgba(0,0,0,0.02),rgba(0,200,50,0.03))] bg-size-[100%_3px,3px_100%] shadow-[inset_0_0_80px_rgba(0,0,0,0.8)]"></div>

            {/* Cadre style moniteur rétro */}
            <div className="w-full max-w-5xl h-[90vh] border-4 border-[#00ff66] rounded-xl p-4 bg-[#011801] flex flex-col shadow-[0_0_30px_rgba(0,255,102,0.3)] relative">
                
                {/* En-tête du terminal */}
                <header className="border-b-2 border-[#00ff66] pb-2 mb-4 flex justify-between items-center text-sm">
                    <div className="font-bold tracking-widest [text-shadow:0_0_5px_rgba(0,255,102,0.8)]">
                        G.U.I.D.E
                    </div>
                    <div className="flex flex-wrap gap-3 items-center justify-end">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setActiveTab('terminal')} 
                                className={`px-3 py-0.5 border border-[#00ff66] cursor-pointer ${activeTab === 'terminal' ? 'bg-[#00ff66] text-black font-bold' : 'hover:bg-[#00ff66]/20'}`}>
                                Dialog
                            </button>
                            <button 
                                onClick={() => setActiveTab('tasks')} 
                                className={`px-3 py-0.5 border border-[#00ff66] cursor-pointer ${activeTab === 'tasks' ? 'bg-[#00ff66] text-black font-bold' : 'hover:bg-[#00ff66]/20'}`}>
                                Tâches
                            </button>
                            <button 
                                onClick={() => setActiveTab('snippets')} 
                                className={`px-3 py-0.5 border border-[#00ff66] cursor-pointer ${activeTab === 'snippets' ? 'bg-[#00ff66] text-black font-bold' : 'hover:bg-[#00ff66]/20'}`}>
                                Code
                            </button>
                        </div>
                        <button onClick={() => router.push('/account')} className="border border-[#00ff66] px-2 py-0.5 text-xs hover:bg-[#00ff66] hover:text-black">COMPTE</button>
                        {userRole === 'admin' && <span className="border border-[#00ff66] px-2 py-0.5 text-[10px] font-bold tracking-widest">ADMIN</span>}
                    </div>
                </header>

                {appError && <p role="alert" className="mb-3 border border-[#ff5555] px-3 py-2 text-xs text-[#ff7777]">{appError}</p>}

                {/* ZONE DE DIALOGUE AVEC G.U.I.D.E */}
                {activeTab === 'terminal' && (
                    <div className="flex flex-col flex-1 gap-4 overflow-hidden">
                        
                        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 gap-4 rounded border-2 border-[#00ff66] bg-[#011201] p-3 md:grid-cols-[minmax(220px,1fr)_3fr]">
                            {/* Portrait / Illustration de G.U.I.D.E */}
                            <div className="flex min-h-0 flex-col items-center justify-center border-b border-[#00ff66] pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-3">
                                <div style={{ height: 'min(55vh, 384px)' }} className="relative mb-2 w-full max-w-59 overflow-hidden border border-[#00ff66] bg-black/60">
                                    <Image src="/Guide.png" alt="G.U.I.D.E" width={236} height={384} loading="eager" className="h-full w-full object-contain" />

                                </div>
                                <span className="text-xs tracking-widest font-bold">G.U.I.D.E</span>
                            </div>

                            {/* Bulle de texte / Dialogue style RPG rétro */}
                            <div className="flex min-h-0 flex-col justify-between p-2">
                                <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-2 text-sm scrollbar-none [&::-webkit-scrollbar]:hidden">
                                    {messages.map(msg => (
                                        <div key={msg.id} className={msg.sender === 'user' ? 'text-[#00ff99] font-bold' : 'text-[#00ff66]'}>
                                            {`> ${msg.text}`}
                                        </div>
                                    ))}
                                    <div ref={logEndRef} />
                                </div>
                                <div className="text-[10px] text-[#00ff66]/60 mt-1 border-t border-[#00ff66]/30 pt-1">
                                    SYS_STATUS: ACTIVE // CANAL SÉCURISÉ KURO STUDIO
                                </div>
                            </div>
                        </div>

                        {pendingAction && (
                            <section className="border-2 border-[#ffcc33] bg-black/80 p-3 text-xs text-[#ffe28a]" aria-label="Approbation d’une action locale">
                                <p className="mb-2 font-bold tracking-widest">APPROBATION LOCALE REQUISE</p>
                                {pendingAction.name === 'run_local_command' ? (
                                    <>
                                        <p className="mb-1">Commande proposée</p>
                                        <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all border border-[#ffcc33]/50 bg-black p-2">{String(pendingAction.arguments.command ?? '')}</pre>
                                        <p className="mt-2">Cette commande s’exécute avec les droits de ton compte Windows.</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="mb-1">Écriture proposée : {String(pendingAction.arguments.path ?? '')}</p>
                                        <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all border border-[#ffcc33]/50 bg-black p-2">{String(pendingAction.arguments.content ?? '')}</pre>
                                    </>
                                )}
                                <div className="mt-3 flex flex-wrap justify-end gap-2">
                                    <button type="button" onClick={() => void resolvePendingAction(false)} disabled={approvingAction} className="border border-[#ffcc33] px-3 py-2 font-bold hover:bg-[#ffcc33]/15 disabled:opacity-50">
                                        REFUSER
                                    </button>
                                    <button type="button" onClick={() => void resolvePendingAction(true)} disabled={approvingAction} className="border border-[#ffcc33] bg-[#ffcc33] px-3 py-2 font-bold text-black hover:bg-[#ffe28a] disabled:opacity-50">
                                        {approvingAction ? 'TRAITEMENT...' : pendingAction.name === 'run_local_command' ? 'APPROUVER ET EXÉCUTER' : 'APPROUVER L’ÉCRITURE'}
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* Input de discussion en bas */}
                        <form onSubmit={handleChatSubmit} className="flex gap-2 mt-auto">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Message à G.U.I.D.E... ou !Get-Location"
                                maxLength={1500}
                                disabled={sendingMessage || Boolean(pendingAction)}
                                className="flex-1 bg-black border-2 border-[#00ff66] text-[#00ff66] p-2.5 font-mono outline-none text-sm placeholder-[#00ff66]/40"
                                autoFocus
                            />
                            <button type="submit" disabled={sendingMessage || Boolean(pendingAction) || !chatInput.trim()} className="bg-[#012601] border-2 border-[#00ff66] text-[#00ff66] px-6 font-bold hover:bg-[#00ff66] hover:text-black transition-colors cursor-pointer text-sm disabled:cursor-wait disabled:opacity-50">
                                {sendingMessage ? 'RÉFLEXION...' : 'TRANSMETTRE'}
                            </button>
                        </form>
                        {lastTokenUsage && (
                            <p className="text-right text-[10px] text-[#00ff66]/55">
                                Ollama · {lastTokenUsage.inputTokens} tokens entrée · {lastTokenUsage.outputTokens} tokens sortie
                            </p>
                        )}
                    </div>
                )}

                {/* ONGLET TÂCHES */}
                {activeTab === 'tasks' && (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <h2 className="text-sm font-bold border-b border-[#00ff66] pb-2 mb-3 tracking-widest">-- LISTE DES PROTOCOLES & TÂCHES</h2>
                        <form onSubmit={addTask} className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newTaskText}
                                onChange={(e) => setNewTaskText(e.target.value)}
                                placeholder="Nouvelle directive..."
                                className="flex-1 bg-black border border-[#00ff66] text-[#00ff66] p-2 font-mono outline-none text-sm"
                            />
                            <button type="submit" className="bg-[#012601] border border-[#00ff66] text-[#00ff66] px-4 font-bold hover:bg-[#00ff66] hover:text-black text-sm cursor-pointer">
                                AJOUTER
                            </button>
                        </form>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                            {tasks.map(task => (
                                <div key={task.id} className="flex items-center justify-between border border-[#00ff66]/40 p-2.5 bg-black/50 text-sm">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={task.completed} onChange={() => void toggleTask(task)} className="accent-[#00ff66] w-4 h-4 cursor-pointer" />
                                        <span className={task.completed ? 'line-through text-[#00ff66]/40' : 'text-[#00ff66]'}>
                                            {task.text}
                                        </span>
                                    </label>
                                    <button onClick={() => deleteTask(task.id)} className="text-[#ff5555] hover:text-[#ff0000] text-xs cursor-pointer">
                                        [EFFACER]
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ONGLET SNIPPETS */}
                {activeTab === 'snippets' && (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <h2 className="text-sm font-bold border-b border-[#00ff66] pb-2 mb-3 tracking-widest">-- ARCHIVES DE CODE</h2>
                        <form onSubmit={addSnippet} className="flex flex-col gap-2 mb-3 border border-[#00ff66]/40 p-2.5 bg-black/40">
                            <input
                                type="text"
                                value={newSnippetTitle}
                                onChange={(e) => setNewSnippetTitle(e.target.value)}
                                placeholder="Titre du snippet..."
                                className="bg-black border border-[#00ff66] text-[#00ff66] p-1.5 font-mono outline-none text-xs"
                            />
                            <textarea
                                value={newSnippetCode}
                                onChange={(e) => setNewSnippetCode(e.target.value)}
                                placeholder="Code..."
                                rows={2}
                                className="bg-black border border-[#00ff66] text-[#00ff66] p-1.5 font-mono outline-none text-xs resize-none"
                            />
                            <button type="submit" className="bg-[#012601] border border-[#00ff66] text-[#00ff66] py-1.5 font-bold hover:bg-[#00ff66] hover:text-black text-xs cursor-pointer">
                                SAUVEGARDER
                            </button>
                        </form>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                            {snippets.map(snip => (
                                <div key={snip.id} className="border border-[#00ff66]/60 p-2 bg-black/60 rounded">
                                    <div className="font-bold text-xs mb-1"># {snip.title}</div>
                                    <pre className="bg-black p-2 border border-[#00ff66]/20 text-[11px] overflow-x-auto text-[#00ff66]/90">
                                        <code>{snip.code}</code>
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer de style rétro */}
                <footer className="border-t border-[#00ff66]/40 pt-2 mt-3 flex justify-between text-[11px] text-[#00ff66]/70">
                    <div>[ESC] CURSOR // [ENTER] SELECT</div>
                    <div>KURO STUDIO SYSTEM v4.02</div>
                </footer>

            </div>
        </main>
    );
}