import { setConnection, getSyncMeta } from '../db/queries';
import type { SourceId, SyncMeta } from '../../lib/types';
import { syncStrava } from './strava';
import { syncCronometer } from './cronometer';
import { setStrava, setCronometer, getStrava, getCronometer } from './secrets';
import { startReceiver, stopReceiver, HEALTH_ENDPOINT } from './receiver';

/**
 * Ingestion orchestrator — owns the receiver + the periodic poll loop, and is
 * the single entry point the IPC layer calls into. Pull sources (Strava,
 * Cronometer) are polled on an interval; Apple Health is push, handled by the
 * receiver. Every change broadcasts fresh SyncMeta so the UI can live-update.
 */

const STRAVA_INTERVAL = 15 * 60_000;     // 15 min
const CRONOMETER_INTERVAL = 60 * 60_000; // 60 min

let timers: NodeJS.Timeout[] = [];
let broadcast: ((m: SyncMeta) => void) | undefined;

function emit() { broadcast?.(meta()); }

export function meta(): SyncMeta {
  const m = getSyncMeta();
  m.healthEndpoint = HEALTH_ENDPOINT;
  return m;
}

export function startIngestion(onUpdate?: (m: SyncMeta) => void) {
  broadcast = onUpdate;
  startReceiver(() => emit());

  const poll = (fn: () => Promise<number>, source: SourceId) => async () => {
    try { await fn(); } catch (e) { setConnection(source, { status: 'error', detail: (e as Error).message }); }
    emit();
  };
  timers.push(setInterval(() => { if (getStrava()) void poll(syncStrava, 'strava')(); }, STRAVA_INTERVAL));
  timers.push(setInterval(() => { if (getCronometer()) void poll(syncCronometer, 'cronometer')(); }, CRONOMETER_INTERVAL));
}

export function stopIngestion() {
  timers.forEach(clearInterval); timers = [];
  stopReceiver();
}

/** Run one sync now — a single source, or every connected pull source. */
export async function syncNow(source?: SourceId): Promise<SyncMeta> {
  const run = async (s: SourceId, fn: () => Promise<number>, connected: boolean) => {
    if (!connected) return;
    try { await fn(); } catch (e) { setConnection(s, { status: 'error', detail: (e as Error).message }); }
  };
  if (source === 'strava' || !source) await run('strava', syncStrava, !!getStrava());
  if (source === 'cronometer' || !source) await run('cronometer', syncCronometer, !!getCronometer());
  // apple_health has nothing to pull — it arrives via the receiver
  emit();
  return meta();
}

export function disconnect(source: SourceId): SyncMeta {
  if (source === 'strava') setStrava(undefined);
  if (source === 'cronometer') setCronometer(undefined);
  setConnection(source, { status: 'disconnected', detail: undefined });
  emit();
  return meta();
}

export { HEALTH_ENDPOINT };
