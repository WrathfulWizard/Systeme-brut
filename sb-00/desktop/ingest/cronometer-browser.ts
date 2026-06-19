import { BrowserWindow, session } from 'electron';
import { setConnection } from '../db/queries';
import { parseDailyNutrition, writeDailyNutrition } from './cronometer';
import { getCronometer } from './secrets';

/**
 * Cronometer login through a real Chromium window.
 *
 * Cronometer has no public API and fronts the site with bot protection that
 * 403s any non-browser request — which is exactly why the headless
 * username/password scraper keeps failing. Here the operator signs in once in
 * an actual browser window; we persist that session in a dedicated partition
 * and pull the daily CSV export through the same Chromium network stack, so the
 * protection sees a genuine browser. The session survives restarts, so this is
 * effectively a one-time sign-in. Stored credentials (if given) are prefilled
 * to make the occasional re-link nearly hands-off.
 */

const PARTITION = 'persist:cronometer';
const BASE = 'https://cronometer.com';

const cronoSession = () => session.fromPartition(PARTITION);

async function sessionNonce(): Promise<string | null> {
  const cookies = await cronoSession().cookies.get({ domain: 'cronometer.com' });
  return cookies.find((c) => c.name === 'sesnonce')?.value ?? null;
}

/** Open the sign-in window; resolve once the session cookie (sesnonce) appears. */
export function cronometerBrowserLogin(): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = new BrowserWindow({
      width: 460, height: 780, title: 'Cronometer — sign in', autoHideMenuBar: true,
      webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false },
    });
    let settled = false;

    const check = async () => {
      if (settled) return;
      if (await sessionNonce()) {
        settled = true;
        setConnection('cronometer', { status: 'connected', detail: 'browser session' });
        w.removeAllListeners('closed');
        w.close();
        resolve();
      }
    };

    const cred = getCronometer();
    w.webContents.on('did-finish-load', () => {
      // Best-effort prefill on the login page; skips silently if the form moves.
      if (cred && /\/login/.test(w.webContents.getURL())) {
        void w.webContents.executeJavaScript(`(() => {
          const e = document.querySelector('input[type=email],input[name=username],#username');
          const p = document.querySelector('input[type=password],#password');
          if (e && p) {
            e.value = ${JSON.stringify(cred.username)};
            p.value = ${JSON.stringify(cred.password)};
            e.dispatchEvent(new Event('input', { bubbles: true }));
            p.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()`).catch(() => {});
      }
      void check();
    });
    w.webContents.on('did-navigate', () => void check());
    w.webContents.on('did-frame-navigate', () => void check());
    w.on('closed', () => { if (!settled) reject(new Error('Sign-in window closed before login completed.')); });

    w.loadURL(`${BASE}/login/`).catch(reject);
  });
}

/** Pull the trailing 14 days using the persisted browser session. */
export async function cronometerSessionSync(): Promise<number> {
  const nonce = await sessionNonce();
  const expired = 'Cronometer session expired — open Connections and sign in again.';
  if (!nonce) throw new Error(expired);

  const end = new Date();
  const start = new Date(end.getTime() - 14 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `${BASE}/export?nonce=${encodeURIComponent(nonce)}&generate=dailySummary&start=${fmt(start)}&end=${fmt(end)}`;

  const res = await cronoSession().fetch(url);
  if (!res.ok) throw new Error(`Cronometer export failed (${res.status})`);
  const text = await res.text();
  if (/^\s*</.test(text) || /<html/i.test(text.slice(0, 200))) throw new Error(expired);

  const n = writeDailyNutrition(parseDailyNutrition(text));
  setConnection('cronometer', { status: 'connected', detail: 'browser session', lastSyncAt: new Date().toISOString() });
  return n;
}

/** Forget the persisted session (on disconnect). */
export async function clearCronometerSession(): Promise<void> {
  await cronoSession().clearStorageData();
}
