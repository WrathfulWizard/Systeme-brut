import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import type { ModelPullStatus } from '../../lib/types';

/**
 * Make SB-Σ a one-piece program: if Ollama is installed but its daemon isn't
 * running, start it ourselves so the operator never has to keep a terminal open
 * just to keep the local model alive. We never *install* Ollama — that's a
 * deliberate, separate choice — but once it's on the machine the app keeps it up.
 *
 * If Ollama is running but has no models, we also pull the default small model
 * automatically so the operator never has to open a terminal for that either.
 */

// A deliberately small default so SB-Σ loads on memory-constrained machines.
// llama3.2:1b needs ~1.3GB to run; the 3b/8b tiers OOM on laptops with little
// free RAM. Users can pick a larger model on Connections if they have the headroom.
export const DEFAULT_MODEL = 'llama3.2:1b';
const OLLAMA_URL = 'http://127.0.0.1:11434';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function reachable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function installedModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return [];
    const j = (await res.json()) as { models?: { name: string }[] };
    return (j.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}

/** Best guess at the ollama binary, falling back to PATH. */
function ollamaBinary(): string {
  const c: string[] = [];
  if (platform() === 'win32') {
    if (process.env.LOCALAPPDATA) c.push(join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'));
    c.push('C:\\Program Files\\Ollama\\ollama.exe');
  } else if (platform() === 'darwin') {
    c.push('/usr/local/bin/ollama', '/opt/homebrew/bin/ollama', join(homedir(), '.ollama', 'bin', 'ollama'));
  } else {
    c.push('/usr/local/bin/ollama', '/usr/bin/ollama');
  }
  for (const p of c) if (existsSync(p)) return p;
  return 'ollama'; // rely on PATH
}

/**
 * Ensure the Ollama daemon is up. Returns true if it's reachable (already
 * running or successfully started), false if it isn't installed or didn't come
 * up. Never throws — the app runs fine without the agent.
 */
export async function ensureOllamaRunning(log: (m: string) => void = () => {}): Promise<boolean> {
  if (await reachable()) { log('Ollama already running.'); return true; }

  const bin = ollamaBinary();
  log(`Ollama not responding — launching ${bin} serve…`);
  let spawnFailed = false;
  try {
    const child = spawn(bin, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => { spawnFailed = true; }); // ENOENT etc.
    child.unref();
  } catch {
    spawnFailed = true;
  }

  // Poll up to ~10s for it to accept connections.
  for (let i = 0; i < 20; i++) {
    if (spawnFailed) { log('Ollama is not installed (or not on PATH). SB-Σ will stay offline until it is.'); return false; }
    await sleep(500);
    if (await reachable()) { log('Ollama is up.'); return true; }
  }
  log('Started Ollama but it did not become reachable in time.');
  return false;
}

/**
 * Pull the default model if no models are installed. Progress is emitted via
 * the `onProgress` callback so the renderer can show a live download bar.
 * This is always fire-and-forget from main.ts — it never blocks the window.
 */
export async function pullDefaultIfEmpty(
  onProgress: (s: ModelPullStatus) => void,
  log: (m: string) => void = () => {},
): Promise<void> {
  const models = await installedModels();
  if (models.length > 0) { log(`Models present: ${models.join(', ')} — skipping auto-pull.`); return; }

  log(`No models installed. Pulling ${DEFAULT_MODEL} in background…`);
  onProgress({ model: DEFAULT_MODEL, status: 'pulling', pct: 0 });

  try {
    const res = await fetch(`${OLLAMA_URL}/api/pull`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: DEFAULT_MODEL, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`pull request failed (${res.status})`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const obj = JSON.parse(t) as { status?: string; completed?: number; total?: number; error?: string };
          if (obj.error) throw new Error(obj.error);
          const pct = obj.total && obj.completed ? Math.round((obj.completed / obj.total) * 100) : undefined;
          onProgress({ model: DEFAULT_MODEL, status: 'pulling', pct, detail: obj.status });
          log(`[pull] ${obj.status ?? ''}${pct != null ? ` ${pct}%` : ''}`);
        } catch (parseErr) {
          // non-JSON keepalive line — ignore
          if ((parseErr as Error).message && !line.includes('{')) throw parseErr;
        }
      }
    }

    onProgress({ model: DEFAULT_MODEL, status: 'done', pct: 100 });
    log(`✓ ${DEFAULT_MODEL} pulled and ready.`);
  } catch (e) {
    const msg = (e as Error).message;
    onProgress({ model: DEFAULT_MODEL, status: 'error', error: msg });
    log(`Pull failed: ${msg}`);
  }
}
