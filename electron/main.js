const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

const appUrl = 'http://127.0.0.1:3000';
const projectRoot = path.resolve(__dirname, '..');
let nextProcess = null;

async function isServerReady(url) {
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isServerReady(url)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function startNextServer() {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3000'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, BROWSER: 'none' },
  });

  child.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`Next.js exited with code ${code ?? signal ?? 'unknown'}.`);
    }
  });

  return child;
}

async function ensureLocalServer() {
  if (await isServerReady(appUrl)) {
    return;
  }

  nextProcess = startNextServer();
  const ready = await waitForServer(appUrl);
  if (!ready) {
    throw new Error('Le serveur Next.js n’a pas démarré correctement.');
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'G.U.I.D.E',
    backgroundColor: '#0a0a0f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(appUrl);
  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadURL(appUrl);
  });

  mainWindow.on('closed', () => {
    if (nextProcess && !nextProcess.killed) {
      nextProcess.kill('SIGTERM');
    }
  });
}

app.whenReady().then(async () => {
  try {
    await ensureLocalServer();
  } catch (error) {
    console.error(error);
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill('SIGTERM');
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
