import { getDb } from '../db/index';
import { setConnection, getCursor } from '../db/queries';
import { getStrava, setStrava, type StravaSecret } from './secrets';

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
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Strava API credentials missing — set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET');
  }
  return { clientId, clientSecret };
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
  total_elevation_gain: number; start_date_local: string;
}

/** Pull new running activities since the stored high-water mark. */
export async function syncStrava(): Promise<number> {
  const token = await validToken();
  const after = Number(getCursor('strava') ?? 0); // epoch seconds
  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO cardio_sessions (occurred_at, distance_km, duration_sec, pace_avg_sec_per_km, elevation_gain_m, source, external_id)
    VALUES (@occurred_at, @distance_km, @duration_sec, @pace, @elev, 'strava', @external_id)
    ON CONFLICT(external_id) DO UPDATE SET
      distance_km = excluded.distance_km, duration_sec = excluded.duration_sec,
      pace_avg_sec_per_km = excluded.pace_avg_sec_per_km, elevation_gain_m = excluded.elevation_gain_m
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
        if (!/run/i.test(a.sport_type || a.type)) continue;
        const km = a.distance / 1000;
        upsert.run({
          occurred_at: a.start_date_local,
          distance_km: Number(km.toFixed(3)),
          duration_sec: a.moving_time,
          pace: km > 0 ? Math.round(a.moving_time / km) : null,
          elev: a.total_elevation_gain ?? null,
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

  setConnection('strava', { status: 'connected', lastSyncAt: new Date().toISOString(), cursor: String(newest) });
  return imported;
}
