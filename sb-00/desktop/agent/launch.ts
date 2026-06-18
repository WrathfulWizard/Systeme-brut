import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

/**
 * Make SB-Σ a one-piece program: if Ollama is installed but its daemon isn't
 * running, start it ourselves so the operator never has to keep a terminal open
 * just to keep the local model alive. We never *install* Ollama — that's a
 * deliberate, separate choice — but once it's on the machine the app keeps it up.
 */

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
