import { getDb } from '../db/index';
import { setConnection } from '../db/queries';
import { getCronometer } from './secrets';

/**
 * Cronometer ingestion — UNOFFICIAL.
 *
 * Cronometer has never shipped a public API. This logs in with the user's
 * stored username/password (opted into explicitly) and pulls the same
 * "Daily Nutrition" CSV export the web app itself generates — the approach the
 * gocronometer / cronometer-export community clients use. It is against
 * Cronometer's ToS, the login flow can change without notice, and it requires
 * holding the user's credentials (kept OS-encrypted via secrets.ts).
 *
 * The canonical, non-credential path remains Cronometer → Apple Health →
 * the local receiver (source 'cronometer_via_apple_health'). This direct
 * scraper writes source 'cronometer_direct' so the two are distinguishable.
 *
 * The CSV mapping below is pure and unit-tested; the network login/export is
 * best-effort and surfaces a clear error to the Connections panel if the
 * site's flow has drifted.
 */

const BASE = 'https://cronometer.com';

/* ---- cookie jar (minimal) ----------------------------------------------- */
class Jar {
  private jar = new Map<string, string>();
  capture(res: Response) {
    // Node's fetch exposes combined set-cookie via getSetCookie()
    const headers = res.headers as Headers & { getSetCookie?: () => string[] };
    const cookies = headers.getSetCookie?.() ?? [];
    for (const c of cookies) {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) this.jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }
  header() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '); }
  get(name: string) { return this.jar.get(name); }
}

export class CronometerClient {
  private jar = new Jar();

  async login(username: string, password: string): Promise<void> {
    // 1. prime cookies + anti-CSRF token
    const page = await fetch(`${BASE}/login/`, { headers: { 'user-agent': UA } });
    this.jar.capture(page);
    const html = await page.text();
    const anticsrf = /name="anticsrf"\s+value="([^"]+)"/.exec(html)?.[1]
      ?? this.jar.get('sesnonce') ?? '';

    // 2. submit the login form
    const body = new URLSearchParams({ anticsrf, username, password });
    const res = await fetch(`${BASE}/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: this.jar.header(), 'user-agent': UA, referer: `${BASE}/login/`,
      },
      body,
    });
    this.jar.capture(res);
    if (!this.jar.get('sesnonce') && !this.jar.get('JSESSIONID')) {
      throw new Error('Cronometer login rejected — check credentials');
    }
  }

  /** Fetch the Daily Nutrition CSV for an inclusive date range (YYYY-MM-DD). */
  async fetchDailyNutritionCsv(start: string, end: string): Promise<string> {
    const nonce = this.jar.get('sesnonce') ?? '';
    const url = `${BASE}/export?nonce=${encodeURIComponent(nonce)}&generate=dailySummary&start=${start}&end=${end}`;
    const res = await fetch(url, { headers: { cookie: this.jar.header(), 'user-agent': UA } });
    if (!res.ok) throw new Error(`Cronometer export failed (${res.status})`);
    return res.text();
  }
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

/* ---- CSV parsing (pure, testable) --------------------------------------- */

/** Parse a CSV string into rows of header→cell maps; handles quoted fields. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '', row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

const numFrom = (r: Record<string, string>, ...keys: string[]) => {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const entries = Object.entries(r);
  for (const key of keys) {
    const k = norm(key);
    const hit = entries.find(([h]) => norm(h) === k) ?? entries.find(([h]) => norm(h).includes(k));
    if (hit) { const v = parseFloat(hit[1]); if (!Number.isNaN(v)) return v; }
  }
  return undefined;
};

export interface DailyNutrition {
  date: string;
  calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number;
  sodium?: number; potassium?: number; magnesium?: number; calcium?: number;
  vitaminD?: number; vitaminC?: number; vitaminB12?: number; folate?: number;
}

export function parseDailyNutrition(csv: string): DailyNutrition[] {
  return parseCsv(csv)
    .map((r) => {
      const date = r['Date'] ?? r['date'] ?? Object.values(r)[0];
      if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
      return {
        date: date.slice(0, 10),
        calories: numFrom(r, 'Energy (kcal)', 'Energy', 'Calories'),
        protein: numFrom(r, 'Protein (g)', 'Protein'),
        carbs: numFrom(r, 'Carbs (g)', 'Carbohydrates (g)', 'Net Carbs (g)', 'Carbs'),
        fat: numFrom(r, 'Fat (g)', 'Fat'),
        fiber: numFrom(r, 'Fiber (g)', 'Fiber'),
        sodium: numFrom(r, 'Sodium (mg)', 'Sodium'),
        potassium: numFrom(r, 'Potassium (mg)', 'Potassium'),
        magnesium: numFrom(r, 'Magnesium (mg)', 'Magnesium'),
        calcium: numFrom(r, 'Calcium (mg)', 'Calcium'),
        vitaminD: numFrom(r, 'Vitamin D (IU)', 'Vitamin D'),
        vitaminC: numFrom(r, 'Vitamin C (mg)', 'Vitamin C'),
        vitaminB12: numFrom(r, 'B12 (Cobalamin) (µg)', 'Vitamin B12 (µg)', 'B12'),
        folate: numFrom(r, 'Folate (µg)', 'Folate'),
      } as DailyNutrition;
    })
    .filter((x): x is DailyNutrition => x !== null);
}

/* ---- DB write ----------------------------------------------------------- */

const SOURCE = 'cronometer_direct';

export function writeDailyNutrition(days: DailyNutrition[]): number {
  const db = getDb();
  const upLog = db.prepare(`
    INSERT INTO nutrition_logs (logged_on, meal, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, source)
    VALUES (@d, NULL, @kcal, @p, @c, @f, @fb, '${SOURCE}')
    ON CONFLICT(logged_on, meal, source) DO UPDATE SET
      calories_kcal=excluded.calories_kcal, protein_g=excluded.protein_g, carbs_g=excluded.carbs_g,
      fat_g=excluded.fat_g, fiber_g=excluded.fiber_g
  `);
  const upMicro = db.prepare(`
    INSERT INTO micronutrients (logged_on, nutrient, kind, amount, unit, target_amount, rda_pct, source)
    VALUES (@d, @n, @kind, @amt, @unit, @tgt, @rda, '${SOURCE}')
    ON CONFLICT(logged_on, nutrient, source) DO UPDATE SET amount=excluded.amount, rda_pct=excluded.rda_pct
  `);

  const rda = (v: number | undefined, target: number) => (v == null ? null : Math.round((v / target) * 100));

  const tx = db.transaction((rows: DailyNutrition[]) => {
    for (const r of rows) {
      upLog.run({ d: r.date, kcal: r.calories ?? null, p: r.protein ?? null, c: r.carbs ?? null, f: r.fat ?? null, fb: r.fiber ?? null });
      const micros: [string, string, number | undefined, string, number | null, number | null][] = [
        ['Vitamin D', 'vitamin', r.vitaminD, 'IU', 600, rda(r.vitaminD, 600)],
        ['Vitamin B12', 'vitamin', r.vitaminB12, 'µg', 2.4, rda(r.vitaminB12, 2.4)],
        ['Vitamin C', 'vitamin', r.vitaminC, 'mg', 90, rda(r.vitaminC, 90)],
        ['Folate', 'vitamin', r.folate, 'µg', 400, rda(r.folate, 400)],
        ['Sodium', 'electrolyte', r.sodium, 'mg', 2300, null],
        ['Potassium', 'electrolyte', r.potassium, 'mg', 3400, null],
        ['Magnesium', 'mineral', r.magnesium, 'mg', 400, null],
        ['Calcium', 'mineral', r.calcium, 'mg', 1000, null],
      ];
      for (const [n, kind, amt, unit, tgt, rp] of micros) {
        if (amt == null) continue;
        upMicro.run({ d: r.date, n, kind, amt, unit, tgt, rda: rp });
      }
    }
  });
  tx(days);
  return days.length;
}

/** Login with stored creds, pull the trailing 14 days, write to DB. */
export async function syncCronometer(): Promise<number> {
  const cred = getCronometer();
  if (!cred) throw new Error('Cronometer not connected');
  const client = new CronometerClient();
  await client.login(cred.username, cred.password);

  const end = new Date();
  const start = new Date(end.getTime() - 14 * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const csv = await client.fetchDailyNutritionCsv(fmt(start), fmt(end));
  const n = writeDailyNutrition(parseDailyNutrition(csv));

  setConnection('cronometer', { status: 'connected', detail: cred.username, lastSyncAt: new Date().toISOString() });
  return n;
}
