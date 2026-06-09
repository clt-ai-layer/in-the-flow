const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

let mainWindow = null;
let staticServer = null;

const isDev = process.env.NODE_ENV === 'development';
const DEV_URL = 'http://127.0.0.1:5173';
const PREVIEW_URL = 'http://127.0.0.1:4173';
const APP_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(APP_ROOT, 'dist');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveDistFile(requestPath) {
  const decoded = decodeURIComponent((requestPath || '/').split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(DIST_DIR, relative);
  const distRoot = path.resolve(DIST_DIR);

  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${path.sep}`)) {
    return null;
  }

  return filePath;
}

/** Poll until a local HTTP server responds (vite dev or preview). */
function waitForUrl(url, maxAttempts = 40, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryOnce = () => {
      attempts += 1;
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        if (attempts >= maxAttempts) {
          reject(new Error(`Server at ${url} returned ${res.statusCode}`));
          return;
        }
        setTimeout(tryOnce, intervalMs);
      });

      req.on('error', () => {
        if (attempts >= maxAttempts) {
          reject(new Error(`Server at ${url} did not become ready`));
          return;
        }
        setTimeout(tryOnce, intervalMs);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          reject(new Error(`Server at ${url} timed out`));
          return;
        }
        setTimeout(tryOnce, intervalMs);
      });
    };

    tryOnce();
  });
}

/**
 * Production Electron loads via HTTP, not file://.
 * Vite's built index.html uses crossorigin module scripts that fail silently on file://.
 */
function startPreviewServer() {
  if (isDev) {
    return Promise.resolve();
  }

  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return Promise.reject(
      new Error(`Missing ${indexPath}. Run "pnpm build" in InTheFlow before starting Electron.`)
    );
  }

  console.log('Starting static server for Electron on :4173...');

  return new Promise((resolve, reject) => {
    staticServer = http.createServer((req, res) => {
      const pathname = url.parse(req.url || '/').pathname || '/';
      let filePath = resolveDistFile(pathname);

      if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.stat(filePath, (statErr, stats) => {
        if (!statErr && stats.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        } else if (statErr) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        fs.readFile(filePath, (readErr, data) => {
          if (readErr) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
          res.end(data);
        });
      });
    });

    staticServer.on('error', reject);
    staticServer.listen(4173, '127.0.0.1', () => {
      resolve();
    });
  });
}

async function createWindow() {
  const targetUrl = isDev ? DEV_URL : PREVIEW_URL;

  if (isDev) {
    await waitForUrl(DEV_URL).catch((err) => {
      console.warn(`Dev server not ready yet (${err.message}). Loading anyway...`);
    });
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    frame: true,
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  console.log(`Loading ${targetUrl}`);
  await mainWindow.loadURL(targetUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  try {
    await startPreviewServer();
    await createWindow();
  } catch (err) {
    console.error('InTheFlow failed to start:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (mainWindow === null) {
    try {
      await createWindow();
    } catch (err) {
      console.error('Failed to recreate window:', err);
    }
  }
});

app.on('will-quit', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('set-background-color', (_event, hex) => {
  if (mainWindow) mainWindow.setBackgroundColor(hex);
});
