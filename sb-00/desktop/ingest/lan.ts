import { networkInterfaces } from 'node:os';

/**
 * LAN address discovery for the Apple Health receiver. Kept dependency-free so
 * both the receiver and the snapshot query can use it without an import cycle.
 *
 * The phone is a *different device*, so it needs a routable LAN IP — never
 * loopback, and never a 169.254 self-assigned (APIPA) address, which looks
 * valid but is unreachable. We surface every candidate so the operator can pick
 * the one on the phone's subnet.
 */

export const RECEIVER_PORT = Number(process.env.HEALTH_INGEST_PORT ?? 8787);

export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal && !ni.address.startsWith('169.254.')) out.push(ni.address);
    }
  }
  // Real home/office LAN ranges first; virtual-adapter / public IPs last.
  const rank = (a: string) =>
    /^192\.168\./.test(a) ? 0 : /^10\./.test(a) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a) ? 2 : 3;
  return out.sort((a, b) => rank(a) - rank(b));
}

export function lanAddress(): string { return lanAddresses()[0] ?? '127.0.0.1'; }

const endpoint = (ip: string) => `http://${ip}:${RECEIVER_PORT}/ingest/health`;
export function healthEndpoint(): string { return endpoint(lanAddress()); }
export function healthEndpoints(): string[] { return lanAddresses().map(endpoint); }
