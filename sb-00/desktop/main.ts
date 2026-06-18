import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { extname } from 'node:path';

import { openDb } from './db/index';
import { getSnapshot } from './db/queries';
import {
  addSet, updateSet, deleteSet, addAdministration, updateAdministration, deleteAdministration,
  addTitration, deleteTitration, addLabPanel, deleteLabPanel,
  addProtocol, titrateProtocol, endProtocol, deleteProtocol, resolveInsight,
} from './db/mutations';
import { agentStatus, setAgentModel, agentChat, agentReview, agentSweep, type StreamHandlers } from './agent/ollama';
import { ensureOllamaRunning, pullDefaultIfEmpty } from './agent/launch';
import type { LiftInput, AdminInput, TitrationInput, LabPanelInput, ProtocolInput, ChatMessage } from '../lib/types';
import { initSecrets, setCronometer, setStravaApp } from './ingest/secrets';
import { startIngestion, stopIngestion, syncNow, disconnect, meta } from './ingest/index';
import { buildAuthUrl, exchangeCode, syncStrava, STRAVA_REDIRECT_PORT } from './ingest/strava';
import { syncCronometer } from './ingest/cronometer';
import type { SourceId } from '../lib/types';

const DEV = !!process.env.SB_DEV;
const DEV_URL = 'http://localhost:3000';
const STATIC_PORT = 8789;

let win: BrowserWindow | null = null;
let staticServer: Server | null = null;

/* ---- serve the static-exported Next UI (production) ---------------------- */
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
};
function startStaticServer(root: string): Promise<string> {
  return new Promise((resolve) => {
    staticServer = createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let file = join(root, urlPath);
      if (urlPath.endsWith('/')) file = join(file, 'index.html');
      if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
      if (!existsSync(file) || !extname(file)) file = join(root, 'index.html'); // SPA fallback
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    staticServer.listen(STATIC_PORT, '127.0.0.1', () => resolve(`http://127.0.0.1:${STATIC_PORT}/`));
  });
}

/* ---- Strava OAuth loopback ---------------------------------------------- */
function connectStravaFlow(): Promise<ReturnType<typeof meta>> {
  return new Promise((resolve) => {
    let authUrl: string;
    try { authUrl = buildAuthUrl(); }
    catch (e) {
      const m = meta();
      const c = m.connections.find((x) => x.source === 'strava');
      if (c) { c.status = 'error'; c.detail = (e as Error).message; }
      return resolve(m);
    }

    const server = createServer(async (req, res) => {
      if (!req.url?.startsWith('/strava/callback')) { res.writeHead(404); res.end(); return; }
      const code = new URL(req.url, `http://127.0.0.1:${STRAVA_REDIRECT_PORT}`).searchParams.get('code');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body style="background:#0d0d0e;color:#eceef0;font-family:monospace;padding:40px">SB-00 · Strava linked. You can close this tab.</body></html>');
      server.close();
      try {
        if (!code) throw new Error('No authorization code returned');
        await exchangeCode(code);
        await syncStrava();
      } catch { /* error state is recorded by the services */ }
      resolve(meta());
    });
    server.listen(STRAVA_REDIRECT_PORT, '127.0.0.1', () => shell.openExternal(authUrl));
    setTimeout(() => { try { server.close(); } catch {} resolve(meta()); }, 180_000);
  });
}

/* ---- IPC ----------------------------------------------------------------- */
function registerIpc() {
  ipcMain.handle('sb:getSnapshot', () => getSnapshot());
  ipcMain.handle('sb:getConnections', () => meta());
  ipcMain.handle('sb:connectStrava', () => connectStravaFlow());
  ipcMain.handle('sb:connectCronometer', async (_e, username: string, password: string) => {
    setCronometer({ username, password });
    try { await syncCronometer(); } catch { /* recorded as error state */ }
    return meta().connections.find((c) => c.source === 'cronometer')!;
  });
  ipcMain.handle('sb:disconnect', (_e, source: SourceId) => disconnect(source));
  ipcMain.handle('sb:syncNow', (_e, source?: SourceId) => syncNow(source));

  ipcMain.handle('sb:addSet', (_e, input: LiftInput) => { addSet(input); return getSnapshot(); });
  ipcMain.handle('sb:updateSet', (_e, id: number, input: LiftInput) => { updateSet(id, input); return getSnapshot(); });
  ipcMain.handle('sb:deleteSet', (_e, id: number) => { deleteSet(id); return getSnapshot(); });
  ipcMain.handle('sb:addAdministration', (_e, input: AdminInput) => { addAdministration(input); return getSnapshot(); });
  ipcMain.handle('sb:updateAdministration', (_e, id: number, input: AdminInput) => { updateAdministration(id, input); return getSnapshot(); });
  ipcMain.handle('sb:deleteAdministration', (_e, id: number) => { deleteAdministration(id); return getSnapshot(); });
  ipcMain.handle('sb:addTitration', (_e, input: TitrationInput) => { addTitration(input); return getSnapshot(); });
  ipcMain.handle('sb:deleteTitration', (_e, id: number) => { deleteTitration(id); return getSnapshot(); });
  ipcMain.handle('sb:addLabPanel', (_e, input: LabPanelInput) => { addLabPanel(input); return getSnapshot(); });
  ipcMain.handle('sb:deleteLabPanel', (_e, id: number) => { deleteLabPanel(id); return getSnapshot(); });
  ipcMain.handle('sb:saveStravaApp', (_e, clientId: string, clientSecret: string) => {
    setStravaApp({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    return meta();
  });

  // pharmacology protocol
  ipcMain.handle('sb:addProtocol', (_e, input: ProtocolInput) => { addProtocol(input); return getSnapshot(); });
  ipcMain.handle('sb:titrateProtocol', (_e, id: number, newDoseMg: number, note?: string) => { titrateProtocol(id, newDoseMg, note); return getSnapshot(); });
  ipcMain.handle('sb:endProtocol', (_e, id: number) => { endProtocol(id); return getSnapshot(); });
  ipcMain.handle('sb:deleteProtocol', (_e, id: number) => { deleteProtocol(id); return getSnapshot(); });

  // flags
  ipcMain.handle('sb:resolveInsight', (_e, id: number) => { resolveInsight(id); return getSnapshot(); });

  // SB-Σ agent (Ollama)
  ipcMain.handle('sb:agentStatus', () => agentStatus());
  ipcMain.handle('sb:setAgentModel', (_e, model: string) => setAgentModel(model));
  const streamHandlers = (): StreamHandlers => ({
    onToken: (chunk) => win?.webContents.send('sb:agentToken', chunk),
    onDone: (full) => win?.webContents.send('sb:agentDone', full),
    onError: (message) => win?.webContents.send('sb:agentError', message),
  });
  ipcMain.handle('sb:agentChat', (_e, messages: ChatMessage[]) => { void agentChat(messages, streamHandlers()); });
  ipcMain.handle('sb:agentReview', () => { void agentReview(streamHandlers()); });
  ipcMain.handle('sb:agentSweep', () => agentSweep());
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 900, backgroundColor: '#0d0d0e',
    title: 'Systeme Brut // SB-00',
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  if (DEV) {
    await win.loadURL(DEV_URL);
  } else {
    const url = await startStaticServer(join(app.getAppPath(), 'out'));
    await win.loadURL(url);
  }
}

app.whenReady().then(() => {
  openDb(join(app.getPath('userData'), 'systeme-brut.db'));
  initSecrets(join(app.getPath('userData'), 'secrets.bin'));
  registerIpc();
  startIngestion((m) => win?.webContents.send('sb:syncUpdate', m));
  // Keep the local model alive without a separate terminal. If Ollama is up but
  // empty, pull the default small model automatically — all fire-and-forget so
  // the window never waits on it. Events are forwarded to the renderer.
  void ensureOllamaRunning((m) => console.log('[ollama]', m)).then((up) => {
    if (!up) return;
    void pullDefaultIfEmpty(
      (s) => win?.webContents.send('sb:modelPull', s),
      (m) => console.log('[pull]', m),
    );
  });
  createWindow();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('quit', () => { stopIngestion(); staticServer?.close(); });
