import { safeStorage } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Connection secrets — OAuth tokens and the (user-opted-in) Cronometer login.
 *
 * Stored encrypted at rest via Electron's safeStorage, which uses the OS
 * keychain (Keychain on macOS, libsecret on Linux, DPAPI on Windows). The
 * plaintext only exists in memory while a sync runs. Nothing here is ever
 * written to SQLite or committed to disk in the clear.
 */

export interface StravaSecret {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;        // epoch seconds
  athlete?: string;
}
export interface CronometerSecret {
  username: string;
  password: string;         // required by the unofficial export client (no API)
}
export interface StravaApp {
  clientId: string;
  clientSecret: string;     // user's own Strava API application credentials
}

interface Vault {
  strava?: StravaSecret;
  stravaApp?: StravaApp;
  cronometer?: CronometerSecret;
  /** Marker that the browser-session login is the active Cronometer path. The
   *  cookies themselves live in the Electron 'persist:cronometer' partition. */
  cronometerSession?: { linkedAt: string };
  /** Bearer token the Apple Health receiver requires (gates the LAN + tunnel
   *  endpoint so an internet-exposed receiver can't be written to anonymously). */
  healthToken?: string;
}

let secretsPath = '';
let cache: Vault | null = null;

export function initSecrets(path: string) {
  secretsPath = path;
}

function load(): Vault {
  if (cache) return cache;
  if (!existsSync(secretsPath)) { cache = {}; return cache; }
  try {
    const enc = readFileSync(secretsPath);
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(enc)
      : enc.toString('utf8'); // dev fallback if no OS keychain
    cache = JSON.parse(json) as Vault;
  } catch {
    cache = {};
  }
  return cache;
}

function persist(v: Vault) {
  cache = v;
  const json = JSON.stringify(v);
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8');
  writeFileSync(secretsPath, buf, { mode: 0o600 });
}

export function getStrava() { return load().strava; }
export function setStrava(s: StravaSecret | undefined) { const v = load(); v.strava = s; persist(v); }

export function getStravaApp() { return load().stravaApp; }
export function setStravaApp(a: StravaApp | undefined) { const v = load(); v.stravaApp = a; persist(v); }

export function getCronometer() { return load().cronometer; }
export function setCronometer(c: CronometerSecret | undefined) { const v = load(); v.cronometer = c; persist(v); }

export function getCronometerSession() { return load().cronometerSession; }
export function setCronometerSession(s: { linkedAt: string } | undefined) { const v = load(); v.cronometerSession = s; persist(v); }

export function getHealthToken() { return load().healthToken; }
/** Return the receiver token, generating + persisting one on first use. */
export function ensureHealthToken(gen: () => string): string {
  const v = load();
  if (!v.healthToken) { v.healthToken = gen(); persist(v); }
  return v.healthToken;
}
