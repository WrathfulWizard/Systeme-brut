import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Cloudflare quick tunnel for the Apple Health receiver — so the phone can push
 * over cellular when away from home, without port-forwarding or inbound firewall
 * holes (cloudflared dials *out* to Cloudflare and proxies back to localhost).
 *
 * Requires the `cloudflared` binary on PATH (one-time install). The quick-tunnel
 * URL is ephemeral — it changes each time the tunnel (re)starts — so the public
 * endpoint shown in the UI must be re-pasted into Health Auto Export after a
 * restart. The endpoint is always bearer-token gated (see receiver.ts).
 */

export interface TunnelState { running: boolean; url?: string; installed: boolean; error?: string; }

let proc: ChildProcess | null = null;
let url: string | undefined;
let installed = true;
let error: string | undefined;

export function tunnelState(): TunnelState { return { running: !!proc, url, installed, error }; }

export function startTunnel(port: number, notify: (s: TunnelState) => void): void {
  if (proc) { notify(tunnelState()); return; }
  url = undefined; error = undefined;

  proc = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`]);

  const scan = (buf: Buffer) => {
    const m = buf.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !url) { url = m[0]; notify(tunnelState()); }
  };
  proc.stdout?.on('data', scan);
  proc.stderr?.on('data', scan);
  proc.on('error', (e) => {
    installed = (e as NodeJS.ErrnoException).code !== 'ENOENT';
    error = installed ? e.message : 'cloudflared is not installed — install it, then enable internet sync again.';
    proc = null; url = undefined; notify(tunnelState());
  });
  proc.on('exit', () => { proc = null; url = undefined; notify(tunnelState()); });
}

export function stopTunnel(): void { if (proc) { proc.kill(); proc = null; url = undefined; } }
