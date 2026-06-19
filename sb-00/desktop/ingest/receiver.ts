import { createServer, type Server } from 'node:http';
import { networkInterfaces } from 'node:os';
import { applyHealthExport } from './appleHealth';

/**
 * Local ingestion receiver — the endpoint the phone-side Apple Health bridge
 * (Health Auto Export / a Shortcut) POSTs to on a schedule.
 *
 * IMPORTANT: the phone is a *different device* on the same network, so the
 * server binds to 0.0.0.0 (all interfaces) and the Connections screen shows the
 * machine's LAN IP — `127.0.0.1` would only be reachable from this PC itself,
 * never from the phone. An optional bearer token (HEALTH_INGEST_TOKEN) gates
 * writes for anyone wanting to lock the LAN-exposed endpoint down.
 *
 *   POST http://<lan-ip>:8787/ingest/health   body: Health Auto Export JSON
 */

const BIND = '0.0.0.0';
export const RECEIVER_PORT = Number(process.env.HEALTH_INGEST_PORT ?? 8787);

/** Best-guess LAN IPv4 for this machine, so the phone has a reachable address. */
export function lanAddress(): string {
  const ifaces = networkInterfaces();
  const candidates: string[] = [];
  for (const list of Object.values(ifaces)) {
    for (const ni of list ?? []) {
      // Skip loopback and 169.254.x APIPA (a self-assigned address looks valid
      // but the phone can never reach it — a common "invalid/unreachable" cause).
      if (ni.family === 'IPv4' && !ni.internal && !ni.address.startsWith('169.254.')) candidates.push(ni.address);
    }
  }
  // Prefer common private ranges (home/office LAN) over anything exotic.
  const preferred = candidates.find((a) => /^192\.168\./.test(a))
    ?? candidates.find((a) => /^10\./.test(a))
    ?? candidates.find((a) => /^172\.(1[6-9]|2\d|3[01])\./.test(a))
    ?? candidates[0];
  return preferred ?? '127.0.0.1';
}

export function healthEndpoint(): string {
  return `http://${lanAddress()}:${RECEIVER_PORT}/ingest/health`;
}

// Back-compat constant (loopback form) — prefer healthEndpoint() for display.
export const HEALTH_ENDPOINT = `http://127.0.0.1:${RECEIVER_PORT}/ingest/health`;

let server: Server | null = null;

export function startReceiver(onIngest?: () => void): Server {
  if (server) return server;
  const token = process.env.HEALTH_INGEST_TOKEN;

  server = createServer((req, res) => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }

    if (req.method === 'POST' && req.url?.startsWith('/ingest/health')) {
      if (token) {
        const auth = req.headers.authorization ?? '';
        if (auth !== `Bearer ${token}`) { res.writeHead(401, cors); res.end('unauthorized'); return; }
      }
      let raw = '';
      req.on('data', (c) => { raw += c; if (raw.length > 50_000_000) req.destroy(); });
      req.on('end', () => {
        try {
          const result = applyHealthExport(JSON.parse(raw));
          onIngest?.();
          res.writeHead(200, { 'content-type': 'application/json', ...cors });
          res.end(JSON.stringify({ ok: true, ...result }));
        } catch (e) {
          res.writeHead(400, { 'content-type': 'application/json', ...cors });
          res.end(JSON.stringify({ ok: false, error: (e as Error).message }));
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, cors); res.end('ok'); return; }
    res.writeHead(404, cors); res.end('not found');
  });

  server.listen(RECEIVER_PORT, BIND);
  return server;
}

export function stopReceiver() { server?.close(); server = null; }
