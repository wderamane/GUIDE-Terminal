import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_MESSAGE_LENGTH = 1500;
const HISTORY_LIMIT = 10;
const MAX_OUTPUT_TOKENS = 512;
const MODEL = 'llama3.2:latest';
const OLLAMA_URL = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, '');

export async function POST(request: NextRequest) {
    if (request.headers.get('origin') !== request.nextUrl.origin) {
        return NextResponse.json({ error: 'Requête non autorisée.' }, { status: 403 });
    }

    let supabase;
    try {
        supabase = await createClient();
    } catch {
        return NextResponse.json({ error: 'La connexion Supabase n’est pas configurée.' }, { status: 503 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Connecte-toi pour discuter avec G.U.I.D.E.' }, { status: 401 });
    }

    let body: { message?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > MAX_MESSAGE_LENGTH) {
        return NextResponse.json({ error: `Le message doit contenir de 1 à ${MAX_MESSAGE_LENGTH} caractères.` }, { status: 400 });
    }

    const { data: history, error: historyError } = await supabase
        .from('messages')
        .select('sender, text')
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);

    if (historyError) {
        return NextResponse.json({ error: 'Impossible de charger la conversation.' }, { status: 500 });
    }

    const recentMessages = (history ?? []).reverse();
    const latestMessage = recentMessages.at(-1);
    if (latestMessage?.sender !== 'user' || latestMessage.text !== body.message.trim()) {
        return NextResponse.json({ error: 'Le dernier message n’a pas pu être vérifié. Réessaie.' }, { status: 409 });
    }

    const messages = recentMessages.map((message) => ({
        role: message.sender === 'guide' ? 'assistant' as const : 'user' as const,
        content: message.text.slice(0, MAX_MESSAGE_LENGTH),
    }));

    try {
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(90_000),
            body: JSON.stringify({
                model: MODEL,
                stream: false,
                messages: [
                    {
                        role: 'system',
                        content: 'Tu es G.U.I.D.E, l’assistant de Kuro Studio. Réponds toujours en français, clairement, avec chaleur et concision. Aide sur le développement logiciel et les tâches du studio. Ne prétends pas avoir exécuté une action que tu n’as pas faite.',
                    },
                    ...messages,
                ],
                options: { num_predict: MAX_OUTPUT_TOKENS },
            }),
        });

        if (!response.ok) {
            console.error('Ollama returned HTTP status:', response.status);
            return NextResponse.json({ error: 'Ollama n’a pas pu traiter le message. Vérifie que le service local fonctionne.' }, { status: 502 });
        }

        const result = await response.json() as {
            message?: { content?: unknown };
            prompt_eval_count?: number;
            eval_count?: number;
        };
        const text = typeof result.message?.content === 'string' ? result.message.content.trim() : '';

        if (!text) {
            return NextResponse.json({ error: 'Llama n’a pas renvoyé de texte. Réessaie.' }, { status: 502 });
        }

        return NextResponse.json({
            text,
            usage: {
                inputTokens: result.prompt_eval_count ?? 0,
                outputTokens: result.eval_count ?? 0,
            },
        });
    } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'TimeoutError';
        console.error('Ollama request failed:', error instanceof Error ? error.name : 'unknown error');
        return NextResponse.json({
            error: isTimeout
                ? 'Llama met trop longtemps à répondre. Réessaie.'
                : 'Impossible de joindre Ollama. Vérifie que le service local fonctionne.',
        }, { status: 502 });
    }
}