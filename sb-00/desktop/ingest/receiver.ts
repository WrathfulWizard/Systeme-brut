import { createServer, type Server } from 'node:http';
import { applyHealthExport } from './appleHealth';

/**
 * Local ingestion receiver — the endpoint the phone-side Apple Health bridge
 * (Health Auto Export / a Shortcut) POSTs to on a schedule. Binds to loopback
 * only; an optional bearer token (HEALTH_INGEST_TOKEN) gates writes.
 *
 *   POST http://<host>:8787/ingest/health   body: Health Auto Export JSON
 */

const HOST = '127.0.0.1';
export const RECEIVER_PORT = Number(process.env.HEALTH_INGEST_PORT ?? 8787);
export const HEALTH_ENDPOINT = `http://${HOST}:${RECEIVER_PORT}/ingest/health`;

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

  server.listen(RECEIVER_PORT, HOST);
  return server;
}

export function stopReceiver() { server?.close(); server = null; }
