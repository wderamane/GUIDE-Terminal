import { execFile } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const defaultRoot = process.platform === 'win32'
    ? (process.env.USERPROFILE || (process.env.HOMEDRIVE && process.env.HOMEPATH ? resolve(process.env.HOMEDRIVE, process.env.HOMEPATH) : process.cwd()))
    : (process.env.HOME || process.cwd());
const configuredRoot = (process.env.LOCAL_AGENT_ROOT && process.env.LOCAL_AGENT_ROOT.trim()) || defaultRoot;
const port = Number(process.env.LOCAL_AGENT_PORT || 4317);
const tokenPath = resolve(projectRoot, '.local-agent-token');
const ignoredDirectories = new Set(['.git', '.next', 'node_modules', 'out', 'coverage']);
const maxFileBytes = 256 * 1024;
const maxRequestBytes = 512 * 1024;

function isSensitivePath(relativePath) {
    const parts = relativePath.replaceAll('\\', '/').split('/').filter(Boolean).map(part => part.toLocaleLowerCase());
    const sensitiveParts = new Set([
        '.local-agent-token',
        '.ssh', '.aws', '.azure', '.kube', '.npmrc', '.pypirc', '.netrc',
        'appdata', 'application data', 'roaming', 'local', 'locallow', 'cookies',
        'windows', 'system32', 'program files', 'program files (x86)', 'programdata', 'recovery', 'winsxs',
        'desktop.ini', 'ntuser.dat', 'ntuser.ini'
    ]);
    return parts.some(part => sensitiveParts.has(part) || /^\.env(?:$|\.)/i.test(part))
        || /^(?:id_rsa|id_ed25519|credentials\.json|secrets\.json)$/i.test(parts.at(-1) ?? '')
        || /\.(?:pem|key|p12|pfx)$/i.test(parts.at(-1) ?? '');
}

function validateRootPath(rootPath) {
    const normalized = rootPath.replaceAll('\\', '/').toLocaleLowerCase();
    const blockedSegments = ['windows', 'system32', 'program files', 'program files (x86)', 'programdata', 'recovery', 'winsxs'];
    if (blockedSegments.some(segment => normalized.includes(`/${segment}/`) || normalized.endsWith(`/${segment}`) || normalized === segment)) {
        throw new Error('Le dossier autorisé ne peut pas être un dossier système ou de Windows.');
    }
    return rootPath;
}

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('LOCAL_AGENT_PORT doit être un port valide entre 1024 et 65535.');
}

const candidateRoot = isAbsolute(configuredRoot) ? configuredRoot : resolve(projectRoot, configuredRoot);
const root = await realpath(validateRootPath(candidateRoot));
let token;
try {
    token = (await readFile(tokenPath, 'utf8')).trim();
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
    token = randomBytes(32).toString('hex');
    try {
        await writeFile(tokenPath, `${token}\n`, { flag: 'wx', mode: 0o600 });
    } catch (writeError) {
        if (writeError.code !== 'EEXIST') throw writeError;
        token = (await readFile(tokenPath, 'utf8')).trim();
    }
}

function isWithinRoot(candidate) {
    const pathFromRoot = relative(root, candidate);
    return pathFromRoot === '' || (pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot));
}

async function resolveExisting(inputPath) {
    if (typeof inputPath !== 'string' || !inputPath.trim() || inputPath.includes('\0')) {
        throw new Error('Le chemin doit être valide et situé dans le dossier autorisé.');
    }
    const target = isAbsolute(inputPath) ? resolve(inputPath) : resolve(root, inputPath);
    if (!isWithinRoot(target)) throw new Error('Le chemin demandé sort du dossier autorisé.');
    let canonical;
    try {
        canonical = await realpath(target);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return target;
        }
        throw error;
    }
    if (!isWithinRoot(canonical)) throw new Error('Le chemin demandé sort du dossier autorisé.');
    return canonical;
}

async function readLocalFile(inputPath) {
    const target = await resolveExisting(inputPath);
    if (isSensitivePath(relative(root, target))) throw new Error('L’accès aux fichiers contenant des secrets est bloqué.');
    const fileStats = await stat(target);
    if (fileStats.isDirectory()) {
        const entries = await readdir(target, { withFileTypes: true });
        const lines = entries
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(entry => `${entry.isDirectory() ? '[D]' : '[F]'} ${entry.name}`);
        return `Dossier: ${relative(root, target) || '.'}\n${lines.join('\n') || 'Le dossier est vide.'}`;
    }
    const contents = await readFile(target);
    if (contents.byteLength > maxFileBytes) throw new Error('Le fichier dépasse la limite de lecture de 256 Ko.');
    if (contents.includes(0)) throw new Error('Le fichier semble binaire et ne peut pas être lu comme du texte.');
    return contents.toString('utf8');
}

async function searchLocalFiles(query) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 200) {
        throw new Error('La recherche doit contenir entre 2 et 200 caractères.');
    }

    const matches = [];
    let visited = 0;
    const needle = query.toLocaleLowerCase();

    async function walk(directory, depth) {
        if (depth > 8 || matches.length >= 40 || visited >= 2000) return;
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            if (matches.length >= 40 || visited >= 2000) return;
            if (entry.isSymbolicLink()) continue;
            const target = resolve(directory, entry.name);
            if (entry.isDirectory()) {
                if (!ignoredDirectories.has(entry.name) && !isSensitivePath(relative(root, target))) await walk(target, depth + 1);
                continue;
            }
            if (!entry.isFile() || isSensitivePath(relative(root, target))) continue;
            visited += 1;
            try {
                const contents = await readFile(target);
                if (contents.byteLength > maxFileBytes || contents.includes(0)) continue;
                const text = contents.toString('utf8');
                const offset = text.toLocaleLowerCase().indexOf(needle);
                if (offset < 0) continue;
                const line = text.slice(0, offset).split('\n').length;
                const excerpt = text.slice(Math.max(0, offset - 120), Math.min(text.length, offset + query.length + 240)).replace(/\s+/g, ' ').trim();
                matches.push({ path: relative(root, target), line, excerpt });
            } catch {
                continue;
            }
        }
    }

    await walk(root, 0);
    return { matches, visitedFiles: visited, truncated: visited >= 2000 || matches.length >= 40 };
}

async function writeLocalFile({ path, content, expectedContent, approved }) {
    if (approved !== true) throw new Error('Une approbation explicite est requise pour écrire un fichier.');
    if (typeof path !== 'string' || typeof content !== 'string' || content.length > maxFileBytes) {
        throw new Error('Chemin ou contenu invalide; limite d’écriture : 256 Ko.');
    }
    const target = isAbsolute(path) ? resolve(path) : resolve(root, path);
    if (!isWithinRoot(target) || path.includes('\0') || isSensitivePath(relative(root, target))) {
        throw new Error('Le chemin demandé sort du dossier autorisé.');
    }
    const parent = await realpath(dirname(target));
    if (!isWithinRoot(parent)) throw new Error('Le chemin demandé sort du dossier autorisé.');

    let currentContent = null;
    try {
        const canonicalTarget = await realpath(target);
        if (!isWithinRoot(canonicalTarget)) throw new Error('Le chemin demandé sort du dossier autorisé.');
        currentContent = await readFile(canonicalTarget, 'utf8');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    if (currentContent !== expectedContent) {
        throw new Error('Le fichier a changé depuis sa lecture ou existe déjà. Relis-le avant de proposer une nouvelle écriture.');
    }

    await writeFile(target, content, { encoding: 'utf8', flag: currentContent === null ? 'wx' : 'w' });
    return { path, bytesWritten: Buffer.byteLength(content), status: 'written' };
}

async function validateLocalWrite({ path, expectedContent }) {
    if (typeof path !== 'string' || !path.trim() || path.includes('\0')) {
        throw new Error('Le chemin doit être valide et ne peut pas viser un fichier sensible.');
    }
    if (expectedContent !== null && typeof expectedContent !== 'string') {
        throw new Error('Le contenu original du fichier n’a pas pu être vérifié.');
    }

    const target = isAbsolute(path) ? resolve(path) : resolve(root, path);
    if (!isWithinRoot(target) || isSensitivePath(relative(root, target))) {
        throw new Error('Le chemin demandé sort du dossier autorisé.');
    }
    const parent = await realpath(dirname(target));
    if (!isWithinRoot(parent)) throw new Error('Le chemin demandé sort du dossier autorisé.');

    let currentContent = null;
    try {
        const canonicalTarget = await realpath(target);
        if (!isWithinRoot(canonicalTarget) || isSensitivePath(relative(root, canonicalTarget))) {
            throw new Error('Le chemin demandé sort du dossier autorisé.');
        }
        currentContent = await readFile(canonicalTarget, 'utf8');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    if (currentContent !== expectedContent) {
        throw new Error('Le fichier a changé depuis sa lecture ou existe déjà. Relis-le avant de proposer une nouvelle écriture.');
    }
    return { path, exists: currentContent !== null, status: 'ready' };
}

async function runLocalCommand({ command, approved }) {
    if (approved !== true) throw new Error('Une approbation explicite est requise pour exécuter une commande.');
    if (typeof command !== 'string' || !command.trim() || command.length > 1000) {
        throw new Error('La commande doit contenir entre 1 et 1000 caractères.');
    }
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
    const args = process.platform === 'win32'
        ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command]
        : ['-lc', command];
    const result = await execFileAsync(shell, args, {
        cwd: root,
        timeout: 30_000,
        maxBuffer: 256 * 1024,
        windowsHide: true,
    });
    return {
        exitCode: 0,
        stdout: result.stdout.slice(0, 20_000),
        stderr: result.stderr.slice(0, 20_000),
        workingDirectory: root,
    };
}

async function handleAction(body) {
    switch (body.operation) {
        case 'read':
            return { content: await readLocalFile(body.path) };
        case 'search':
            return await searchLocalFiles(body.query);
        case 'validate-write':
            return await validateLocalWrite(body);
        case 'write':
            return await writeLocalFile(body);
        case 'command':
            return await runLocalCommand(body);
        default:
            throw new Error('Opération locale inconnue.');
    }
}

const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (request.method !== 'POST' || request.url !== '/action') {
        response.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    const authorization = request.headers.authorization ?? '';
    const suppliedToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const suppliedBuffer = Buffer.from(suppliedToken);
    const expectedBuffer = Buffer.from(token);
    if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
        response.writeHead(401).end(JSON.stringify({ error: 'Unauthorized' }));
        return;
    }

    let rawBody = '';
    for await (const chunk of request) {
        rawBody += chunk;
        if (Buffer.byteLength(rawBody) > maxRequestBytes) {
            response.writeHead(413).end(JSON.stringify({ error: 'Request too large' }));
            return;
        }
    }

    try {
        const result = await handleAction(JSON.parse(rawBody));
        response.writeHead(200).end(JSON.stringify({ result }));
    } catch (error) {
        response.writeHead(400).end(JSON.stringify({ error: error instanceof Error ? error.message : 'Local action failed' }));
    }
});

server.listen(port, '127.0.0.1', () => {
    console.log(`G.U.I.D.E local agent listening on 127.0.0.1:${port}`);
    console.log(`Authorized folder: ${root}`);
    console.log('Keep this process running while using local tools.');
});