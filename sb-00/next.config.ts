import type { NextConfig } from 'next';

/**
 * SB-00 ships as a static bundle loaded inside Electron — there is no Next
 * server at runtime. `output: 'export'` emits plain HTML/JS into `out/`, which
 * the Electron main process serves over loopback. All live data comes from the
 * desktop backend via IPC (window.sb); the UI degrades to seed data in a plain
 * browser.
 */
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
