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

// A full, current desktop-Chrome fingerprint. Cronometer fronts the site with
// bot protection that 403s requests missing browser-shaped headers, so every
// request below carries this set — the most common cause of the export 403.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
function browserHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'user-agent': UA,
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'upgrade-insecure-requests': '1',
    ...extra,
  };
}

export class CronometerClient {
  private jar = new Jar();

  async login(username: string, password: string): Promise<void> {
    // 1. prime cookies + anti-CSRF token from the login page
    const page = await fetch(`${BASE}/login/`, { headers: browserHeaders() });
    this.jar.capture(page);
    const html = await page.text();
    const anticsrf = /name="anticsrf"\s+value="([^"]+)"/.exec(html)?.[1]
      ?? /["']anticsrf["']\s*[:=]\s*["']([^"']+)["']/.exec(html)?.[1]
      ?? this.jar.get('sesnonce') ?? '';

    // 2. submit the login form (form-encoded, with a browser-shaped header set)
    const body = new URLSearchParams({ anticsrf, username, password });
    const res = await fetch(`${BASE}/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: browserHeaders({
        'content-type': 'application/x-www-form-urlencoded',
        cookie: this.jar.header(),
        referer: `${BASE}/login/`,
        origin: BASE,
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
      }),
      body,
    });
    this.jar.capture(res);
    if (!this.jar.get('sesnonce') && !this.jar.get('JSESSIONID')) {
      const txt = await res.text().catch(() => '');
      const hint = res.status === 403 ? ' (blocked — bot protection)' : '';
      throw new Error(`Cronometer login rejected (${res.status})${hint} — check email/password${txt && /captcha|recaptcha|turnstile/i.test(txt) ? '; a CAPTCHA was required' : ''}`);
    }
  }

  /** Fetch the Daily Nutrition CSV for an inclusive date range (YYYY-MM-DD). */
  async fetchDailyNutritionCsv(start: string, end: string): Promise<string> {
    const nonce = this.jar.get('sesnonce') ?? '';
    const url = `${BASE}/export?nonce=${encodeURIComponent(nonce)}&generate=dailySummary&start=${start}&end=${end}`;
    const res = await fetch(url, {
      headers: browserHeaders({
        cookie: this.jar.header(),
        referer: `${BASE}/`,
        accept: 'text/csv,application/csv,*/*;q=0.8',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Cronometer export failed (${res.status})${txt ? ` — ${txt.slice(0, 160)}` : ''}`);
    }
    const text = await res.text();
    // A bounced/expired session returns HTML (a login page), not CSV.
    if (/^\s*</.test(text) || /<html/i.test(text.slice(0, 200))) {
      throw new Error('Cronometer export returned a login page — session not authenticated. Re-link credentials.');
    }
    return text;
  }
}

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
  weight?: number;
  // electrolytes / minerals
  sodium?: number; potassium?: number; magnesium?: number; calcium?: number;
  iron?: number; zinc?: number; phosphorus?: number; selenium?: number; copper?: number; manganese?: number;
  // fats
  omega3?: number; omega6?: number; saturated?: number; cholesterol?: number;
  // vitamins
  vitaminA?: number; vitaminC?: number; vitaminD?: number; vitaminE?: number; vitaminK?: number;
  thiamin?: number; riboflavin?: number; niacin?: number; vitaminB6?: number; vitaminB12?: number; folate?: number;
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
        weight: numFrom(r, 'Weight (kg)', 'Weight'),
        sodium: numFrom(r, 'Sodium (mg)', 'Sodium'),
        potassium: numFrom(r, 'Potassium (mg)', 'Potassium'),
        magnesium: numFrom(r, 'Magnesium (mg)', 'Magnesium'),
        calcium: numFrom(r, 'Calcium (mg)', 'Calcium'),
        iron: numFrom(r, 'Iron (mg)', 'Iron'),
        zinc: numFrom(r, 'Zinc (mg)', 'Zinc'),
        phosphorus: numFrom(r, 'Phosphorus (mg)', 'Phosphorus'),
        selenium: numFrom(r, 'Selenium (µg)', 'Selenium'),
        copper: numFrom(r, 'Copper (mg)', 'Copper'),
        manganese: numFrom(r, 'Manganese (mg)', 'Manganese'),
        omega3: numFrom(r, 'Omega-3 (g)', 'Omega 3', 'Omega-3'),
        omega6: numFrom(r, 'Omega-6 (g)', 'Omega 6', 'Omega-6'),
        saturated: numFrom(r, 'Saturated (g)', 'Saturated Fat'),
        cholesterol: numFrom(r, 'Cholesterol (mg)', 'Cholesterol'),
        vitaminA: numFrom(r, 'Vitamin A (µg)', 'Vitamin A'),
        vitaminC: numFrom(r, 'Vitamin C (mg)', 'Vitamin C'),
        vitaminD: numFrom(r, 'Vitamin D (IU)', 'Vitamin D'),
        vitaminE: numFrom(r, 'Vitamin E (mg)', 'Vitamin E'),
        vitaminK: numFrom(r, 'Vitamin K (µg)', 'Vitamin K'),
        thiamin: numFrom(r, 'Thiamine (mg)', 'Thiamin (mg)', 'B1'),
        riboflavin: numFrom(r, 'Riboflavin (mg)', 'B2'),
        niacin: numFrom(r, 'Niacin (mg)', 'B3'),
        vitaminB6: numFrom(r, 'Vitamin B6 (mg)', 'B6 (Pyridoxine) (mg)', 'B6'),
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
  const upBody = db.prepare(`
    INSERT INTO body_metrics (measured_on, weight_kg) VALUES (@d, @w)
    ON CONFLICT(measured_on) DO UPDATE SET weight_kg=COALESCE(excluded.weight_kg, weight_kg)
  `);
  const upWeight = db.prepare(`
    INSERT INTO wearable_readings (measured_at, metric, value, unit, device_source)
    VALUES (@at, 'body_mass', @v, 'kg', 'cronometer')
    ON CONFLICT(measured_at, metric, device_source) DO UPDATE SET value=excluded.value
  `);

  const tx = db.transaction((rows: DailyNutrition[]) => {
    for (const r of rows) {
      upLog.run({ d: r.date, kcal: r.calories ?? null, p: r.protein ?? null, c: r.carbs ?? null, f: r.fat ?? null, fb: r.fiber ?? null });
      // Bodyweight from Cronometer's biometrics column (if present in the export).
      if (r.weight != null) { upBody.run({ d: r.date, w: r.weight }); upWeight.run({ at: `${r.date}T06:30:00`, v: r.weight }); }
      const micros: [string, string, number | undefined, string, number | null, number | null][] = [
        // vitamins
        ['Vitamin A', 'vitamin', r.vitaminA, 'µg', 900, rda(r.vitaminA, 900)],
        ['Vitamin C', 'vitamin', r.vitaminC, 'mg', 90, rda(r.vitaminC, 90)],
        ['Vitamin D', 'vitamin', r.vitaminD, 'IU', 600, rda(r.vitaminD, 600)],
        ['Vitamin E', 'vitamin', r.vitaminE, 'mg', 15, rda(r.vitaminE, 15)],
        ['Vitamin K', 'vitamin', r.vitaminK, 'µg', 120, rda(r.vitaminK, 120)],
        ['Thiamin (B1)', 'vitamin', r.thiamin, 'mg', 1.2, rda(r.thiamin, 1.2)],
        ['Riboflavin (B2)', 'vitamin', r.riboflavin, 'mg', 1.3, rda(r.riboflavin, 1.3)],
        ['Niacin (B3)', 'vitamin', r.niacin, 'mg', 16, rda(r.niacin, 16)],
        ['Vitamin B6', 'vitamin', r.vitaminB6, 'mg', 1.7, rda(r.vitaminB6, 1.7)],
        ['Vitamin B12', 'vitamin', r.vitaminB12, 'µg', 2.4, rda(r.vitaminB12, 2.4)],
        ['Folate', 'vitamin', r.folate, 'µg', 400, rda(r.folate, 400)],
        // minerals / electrolytes
        ['Sodium', 'electrolyte', r.sodium, 'mg', 2300, null],
        ['Potassium', 'electrolyte', r.potassium, 'mg', 3400, null],
        ['Magnesium', 'mineral', r.magnesium, 'mg', 400, null],
        ['Calcium', 'mineral', r.calcium, 'mg', 1000, null],
        ['Iron', 'mineral', r.iron, 'mg', 8, rda(r.iron, 8)],
        ['Zinc', 'mineral', r.zinc, 'mg', 11, rda(r.zinc, 11)],
        ['Phosphorus', 'mineral', r.phosphorus, 'mg', 700, null],
        ['Selenium', 'mineral', r.selenium, 'µg', 55, rda(r.selenium, 55)],
        ['Copper', 'mineral', r.copper, 'mg', 0.9, rda(r.copper, 0.9)],
        ['Manganese', 'mineral', r.manganese, 'mg', 2.3, null],
        // essential fats
        ['Omega-3', 'fat', r.omega3, 'g', 1.6, null],
        ['Omega-6', 'fat', r.omega6, 'g', 17, null],
        ['Saturated fat', 'fat', r.saturated, 'g', null, null],
        ['Cholesterol', 'fat', r.cholesterol, 'mg', null, null],
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

/**
 * Import a CSV the user exported themselves from Cronometer (Account → Export
 * Data, or the "Daily Nutrition" export). This is the reliable, ToS-clean path —
 * no scraping, no 403s, no stored credentials. Returns the number of days
 * written, or throws if the CSV has no recognizable daily rows.
 */
export function importCronometerCsv(csv: string): number {
  const days = parseDailyNutrition(csv);
  if (days.length === 0) {
    throw new Error('No daily rows found — export the "Daily Nutrition" CSV (a Date column with YYYY-MM-DD).');
  }
  const n = writeDailyNutrition(days);
  setConnection('cronometer', { status: 'connected', detail: `CSV import · ${n} days`, lastSyncAt: new Date().toISOString() });
  return n;
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
