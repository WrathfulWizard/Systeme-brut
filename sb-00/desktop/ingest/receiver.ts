import { createServer, type Server } from 'node:http';
import { applyHealthExport } from './appleHealth';
import { getHealthToken } from './secrets';
import { RECEIVER_PORT, lanAddress, healthEndpoint } from './lan';

export { RECEIVER_PORT, lanAddress, healthEndpoint };

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

let server: Server | null = null;

export function startReceiver(onIngest?: () => void): Server {
  if (server) return server;

  server = createServer((req, res) => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }

    if (req.method === 'POST' && req.url?.startsWith('/ingest/health')) {
      // Always token-gated — the endpoint may be exposed to the internet via the
      // tunnel, so an anonymous write must never be accepted. Read per-request so
      // a freshly generated token takes effect without a restart.
      const token = getHealthToken() ?? process.env.HEALTH_INGEST_TOKEN;
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
