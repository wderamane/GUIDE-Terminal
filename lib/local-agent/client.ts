import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type LocalAgentAction =
    | { operation: 'read'; path: string }
    | { operation: 'search'; query: string }
    | { operation: 'validate-write'; path: string; expectedContent: string | null }
    | { operation: 'write'; path: string; content: string; expectedContent: string | null; approved: true }
    | { operation: 'command'; command: string; approved: true };

export async function callLocalAgent(action: LocalAgentAction): Promise<unknown> {
    const port = Number(process.env.LOCAL_AGENT_PORT || 4317);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        throw new Error('Le port du compagnon local est mal configuré.');
    }

    let token: string;
    try {
        token = (await readFile(resolve(process.cwd(), '.local-agent-token'), 'utf8')).trim();
    } catch {
        throw new Error('Le compagnon local n’est pas initialisé. Lance npm run agent, puis réessaie.');
    }
    if (!token) throw new Error('Le jeton du compagnon local est vide.');

    let response: Response;
    try {
        response = await fetch(`http://127.0.0.1:${port}/action`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(action),
            signal: AbortSignal.timeout(40_000),
        });
    } catch {
        throw new Error('Impossible de joindre le compagnon local. Vérifie que npm run agent est lancé.');
    }

    const payload = await response.json() as { result?: unknown; error?: unknown };
    if (!response.ok || typeof payload.error === 'string') {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Le compagnon local a refusé l’action.');
    }
    return payload.result;
}