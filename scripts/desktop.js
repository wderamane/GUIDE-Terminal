const { spawn } = require('node:child_process');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const baseUrl = 'http://127.0.0.1:3000';
const projectRoot = path.resolve(__dirname, '..');

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
    await delay(500);
  }
  return false;
}

function startNextServer() {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3000'], {
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

async function bootstrapDesktop() {
  const nextServerAlreadyRunning = await isServerReady(baseUrl);
  let nextChild = null;

  if (!nextServerAlreadyRunning) {
    console.log('Aucun serveur local détecté. Démarrage de Next.js...');
    nextChild = startNextServer();
    const ready = await waitForServer(baseUrl);
    if (!ready) {
      console.error('Le serveur Next.js n’a pas démarré correctement.');
      if (nextChild && !nextChild.killed) {
        nextChild.kill('SIGTERM');
      }
      process.exit(1);
    }
  }

  const { app, BrowserWindow } = require('electron');

  function createWindow() {
    const win = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1100,
      minHeight: 700,
      title: 'G.U.I.D.E',
      autoHideMenuBar: true,
      backgroundColor: '#0a0a0f',
      webPreferences: {
        preload: path.join(projectRoot, 'electron', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.loadURL(baseUrl);
    win.webContents.on('did-fail-load', () => {
      win.loadURL(baseUrl);
    });

    win.on('closed', () => {
      if (nextChild && !nextChild.killed) {
        nextChild.kill('SIGTERM');
      }
    });
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (nextChild && !nextChild.killed) {
      nextChild.kill('SIGTERM');
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

bootstrapDesktop().catch((error) => {
  console.error(error);
  process.exit(1);
});
