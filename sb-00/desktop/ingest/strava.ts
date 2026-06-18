import { getDb } from '../db/index';
import { setConnection, getCursor } from '../db/queries';
import { getStrava, setStrava, getStravaApp, type StravaSecret } from './secrets';

/**
 * Strava ingestion — the one source with a real public API.
 *
 * Flow: OAuth2 (authorization-code, loopback redirect) → store refreshable
 * tokens → poll /athlete/activities on a schedule → upsert runs into
 * cardio_sessions (source = 'strava', external_id = activity id). Idempotent
 * on external_id, so re-pulling is safe.
 *
 * The user supplies their own Strava API application credentials (the app is
 * single-user / personal). Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in
 * the environment, or the in-app Connections panel will report them missing.
 */

export const STRAVA_REDIRECT_PORT = 8788;
export const STRAVA_REDIRECT_URI = `http://127.0.0.1:${STRAVA_REDIRECT_PORT}/strava/callback`;
const SCOPE = 'read,activity:read_all';

function creds() {
  // prefer credentials saved in-app (Connections screen); fall back to env vars
  const app = getStravaApp();
  const clientId = app?.clientId || process.env.STRAVA_CLIENT_ID;
  const clientSecret = app?.clientSecret || process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Strava API credentials missing — add your Client ID and Secret on the Connections screen');
  }
  return { clientId, clientSecret };
}

/** Whether Strava API app credentials are available (saved or via env). */
export function hasStravaApp(): boolean {
  const app = getStravaApp();
  return !!(app?.clientId && app?.clientSecret) || !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

export function buildAuthUrl(): string {
  const { clientId } = creds();
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
  });
  return `https://www.strava.com/oauth/authorize?${p}`;
}

export async function exchangeCode(code: string): Promise<StravaSecret> {
  const { clientId, clientSecret } = creds();
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed (${res.status})`);
  const j = (await res.json()) as Record<string, any>;
  const secret: StravaSecret = {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: j.expires_at,
    athlete: j.athlete ? `${j.athlete.firstname ?? ''} ${j.athlete.lastname ?? ''}`.trim() : undefined,
  };
  setStrava(secret);
  setConnection('strava', { status: 'connected', detail: secret.athlete || 'Connected' });
  return secret;
}

async function validToken(): Promise<string> {
  const s = getStrava();
  if (!s) throw new Error('Strava not connected');
  if (s.expiresAt - 60 > Date.now() / 1000) return s.accessToken;

  const { clientId, clientSecret } = creds();
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: s.refreshToken }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed (${res.status})`);
  const j = (await res.json()) as Record<string, any>;
  const next: StravaSecret = { ...s, accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: j.expires_at };
  setStrava(next);
  return next.accessToken;
}

interface StravaActivity {
  id: number; type: string; sport_type: string; distance: number; moving_time: number;
  total_elevation_gain: number; start_date_local: string; gear_id?: string;
}

/** Map Strava's many activity types to our three cardio buckets, or null to skip. */
export function mapSport(a: { sport_type?: string; type?: string }): 'run' | 'ride' | 'swim' | null {
  const t = `${a.sport_type ?? ''} ${a.type ?? ''}`.toLowerCase();
  if (/swim/.test(t)) return 'swim';
  if (/ride|bike|cycl/.test(t)) return 'ride';
  if (/run|walk|hike/.test(t)) return 'run';
  return null; // weight training, yoga, etc. — not distance cardio
}

/** Pull new activities (run / ride / swim) since the stored high-water mark. */
export async function syncStrava(): Promise<number> {
  const token = await validToken();
  const after = Number(getCursor('strava') ?? 0); // epoch seconds
  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO cardio_sessions (occurred_at, distance_km, duration_sec, pace_avg_sec_per_km, elevation_gain_m, sport, gear_id, source, external_id)
    VALUES (@occurred_at, @distance_km, @duration_sec, @pace, @elev, @sport, @gear, 'strava', @external_id)
    ON CONFLICT(external_id) DO UPDATE SET
      distance_km = excluded.distance_km, duration_sec = excluded.duration_sec,
      pace_avg_sec_per_km = excluded.pace_avg_sec_per_km, elevation_gain_m = excluded.elevation_gain_m,
      sport = excluded.sport, gear_id = excluded.gear_id
  `);

  let page = 1, imported = 0, newest = after;
  for (;;) {
    const url = new URL('https://www.strava.com/api/v3/athlete/activities');
    url.searchParams.set('after', String(after));
    url.searchParams.set('per_page', '50');
    url.searchParams.set('page', String(page));
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Strava activities fetch failed (${res.status})`);
    const acts = (await res.json()) as StravaActivity[];
    if (acts.length === 0) break;

    const tx = db.transaction((rows: StravaActivity[]) => {
      for (const a of rows) {
        const sport = mapSport(a);
        if (!sport) continue;
        const km = a.distance / 1000;
        upsert.run({
          occurred_at: a.start_date_local,
          distance_km: Number(km.toFixed(3)),
          duration_sec: a.moving_time,
          pace: km > 0 ? Math.round(a.moving_time / km) : null,
          elev: a.total_elevation_gain ?? null,
          sport,
          gear: a.gear_id ?? null,
          external_id: `strava_${a.id}`,
        });
        imported++;
        newest = Math.max(newest, Math.floor(new Date(a.start_date_local).getTime() / 1000));
      }
    });
    tx(acts);
    if (acts.length < 50) break;
    page++;
  }

  // After importing activities, refresh the gear (shoe/bike) catalog + mileage.
  try { await syncStravaGear(token); } catch { /* gear is best-effort */ }

  setConnection('strava', { status: 'connected', lastSyncAt: new Date().toISOString(), cursor: String(newest) });
  return imported;
}

interface StravaGear { id: string; name: string; distance: number; primary?: boolean; retired?: boolean; }

/**
 * Pull the detail for each gear id seen on imported activities and upsert it
 * into `gear` — this powers the running-shoe mileage table. Strava only returns
 * gear detail one id at a time (via /gear/{id}), so we fetch the distinct set.
 */
export async function syncStravaGear(token: string): Promise<number> {
  const db = getDb();
  const ids = (db.prepare(
    "SELECT DISTINCT gear_id FROM cardio_sessions WHERE gear_id IS NOT NULL AND gear_id <> ''",
  ).all() as { gear_id: string }[]).map((r) => r.gear_id);

  const up = db.prepare(`
    INSERT INTO gear (external_id, name, kind, distance_m, retired, source)
    VALUES (@id, @name, @kind, @dist, @retired, 'strava')
    ON CONFLICT(external_id) DO UPDATE SET name=excluded.name, distance_m=excluded.distance_m, retired=excluded.retired
  `);

  let n = 0;
  for (const id of ids) {
    const res = await fetch(`https://www.strava.com/api/v3/gear/${id}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) continue;
    const g = (await res.json()) as StravaGear;
    const kind = id.startsWith('b') ? 'bike' : 'shoe'; // Strava prefixes bikes 'b', shoes 'g'
    up.run({ id: g.id, name: g.name, kind, dist: g.distance ?? 0, retired: g.retired ? 1 : 0 });
    n++;
  }
  return n;
}
