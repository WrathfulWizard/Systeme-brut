// Dev launcher: wait for `next dev` to come up, then start Electron pointed at
// it (SB_DEV=1 makes main.ts load http://localhost:3000 instead of the static
// export). Used by the `desktop:dev` script alongside `next dev`.
import { spawn } from 'node:child_process';

const URL = 'http://localhost:3000';

async function waitFor(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('next dev did not start in time');
}

await waitFor(URL);
const electron = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['electron', '.'],
  { stdio: 'inherit', env: { ...process.env, SB_DEV: '1' } },
);
electron.on('exit', (code) => process.exit(code ?? 0));
