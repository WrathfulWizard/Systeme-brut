// Copy non-TS assets (the .sql schema/seed) into the compiled desktop output,
// since tsc only emits JS. Run after `tsc -p desktop/tsconfig.json`.
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, 'db');
const outDir = join(here, '..', 'dist-electron', 'desktop', 'db');

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(srcDir)) {
  if (f.endsWith('.sql')) {
    copyFileSync(join(srcDir, f), join(outDir, f));
    console.log('copied', f);
  }
}
