import { randomUUID } from 'node:crypto';

export interface OllamaAgentMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string;
    tool_name?: string;
    tool_calls?: Array<{
        type?: string;
        function: {
            name: string;
            arguments: Record<string, unknown>;
        };
    }>;
}

export interface PendingLocalAction {
    id: string;
    userId: string;
    toolName: 'write_local_file' | 'run_local_command';
    directCommand?: boolean;
    arguments: Record<string, unknown>;
    messages: OllamaAgentMessage[];
    usage: { inputTokens: number; outputTokens: number };
    createdAt: number;
}

const pendingActions = new Map<string, PendingLocalAction>();
const approvalLifetimeMs = 10 * 60 * 1000;
const maxPendingActions = 100;

export function savePendingLocalAction(
    action: Omit<PendingLocalAction, 'id' | 'createdAt'>,
): PendingLocalAction {
    const now = Date.now();
    for (const [id, pending] of pendingActions) {
        if (now - pending.createdAt > approvalLifetimeMs) pendingActions.delete(id);
    }
    if (pendingActions.size >= maxPendingActions) {
        const oldestId = pendingActions.keys().next().value;
        if (oldestId) pendingActions.delete(oldestId);
    }

    const pending = { ...action, id: randomUUID(), createdAt: now };
    pendingActions.set(pending.id, pending);
    return pending;
}

export function takePendingLocalAction(id: string, userId: string): PendingLocalAction | null {
    const pending = pendingActions.get(id);
    if (!pending) return null;
    pendingActions.delete(id);
    if (pending.userId !== userId || Date.now() - pending.createdAt > approvalLifetimeMs) return null;
    return pending;
}