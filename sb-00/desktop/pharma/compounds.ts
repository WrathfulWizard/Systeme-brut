/**
 * Built-in pharmacology reference — the "most common steroids info" the hub
 * reasons over. Each entry carries an ESTIMATED elimination/release half-life
 * (the rate-limiting ester depot half-life, in days), plus the visual identity
 * (colour + flow "character") used by the Serum Dynamics visual.
 *
 * Half-lives are population estimates for modelling serum trends — NOT medical
 * advice and not exact for any individual. This is harm-reduction tooling:
 * better to estimate the curve than to fly blind.
 *
 * Matching is by alias substring, longest-alias-wins, so "Test E" resolves to
 * the enanthate ester while a bare "Testosterone" falls back to the family
 * default.
 */

export type Character = 'steady' | 'confident' | 'oscillating' | 'saturated';

export interface CompoundInfo {
  key: string;            // canonical key
  klass: string;          // family label shown in UI
  shortLabel: string;     // terse readout label, e.g. "TEST E"
  halfLifeDays: number;   // estimated elimination / depot-release half-life
  color: string;          // hex — the stream's colour in the visual
  character: Character;    // flow personality in the visual
  aliases: string[];      // lowercased fragments that resolve to this entry
}

// Family identity (colour + character) — anchored to the SERUM DYNAMICS spec:
// Test = cold cyan / steady, Masteron = burnished gold / confident,
// Tren = crimson / oscillating, Deca = saturated orange / saturated.
const FAMILY = {
  testosterone: { klass: 'Testosterone', color: '#6fc6d6', character: 'steady' as Character },
  nandrolone:   { klass: 'Nandrolone',   color: '#cf7a2e', character: 'saturated' as Character },
  trenbolone:   { klass: 'Trenbolone',   color: '#d23123', character: 'oscillating' as Character },
  drostanolone: { klass: 'Drostanolone', color: '#c89b3a', character: 'confident' as Character },
  boldenone:    { klass: 'Boldenone',    color: '#9caa3c', character: 'steady' as Character },
  methenolone:  { klass: 'Methenolone',  color: '#9fb4c4', character: 'steady' as Character },
  stanozolol:   { klass: 'Stanozolol',   color: '#d7d2c4', character: 'confident' as Character },
  oxandrolone:  { klass: 'Oxandrolone',  color: '#d8c074', character: 'steady' as Character },
  methandro:    { klass: 'Methandienone',color: '#b5562f', character: 'saturated' as Character },
  oxymetholone: { klass: 'Oxymetholone', color: '#8e4b2a', character: 'saturated' as Character },
  mesterolone:  { klass: 'Mesterolone',  color: '#b9a06a', character: 'steady' as Character },
  fluoxy:       { klass: 'Fluoxymesterone', color: '#c2563a', character: 'oscillating' as Character },
  ancillary:    { klass: 'Ancillary',    color: '#6f8fd6', character: 'steady' as Character },
} as const;

type Fam = keyof typeof FAMILY;

function entry(key: string, fam: Fam, shortLabel: string, halfLifeDays: number, aliases: string[]): CompoundInfo {
  return { key, ...FAMILY[fam], shortLabel, halfLifeDays, aliases };
}

// ester / variant half-lives in DAYS (estimated, commonly-cited release values)
export const COMPOUNDS: CompoundInfo[] = [
  // Testosterone esters
  entry('test_susp',  'testosterone', 'TEST SUS',  0.5,  ['testosterone suspension', 'test suspension', 'test base', 'test no ester']),
  entry('test_prop',  'testosterone', 'TEST P',    0.8,  ['testosterone propionate', 'test prop', 'test p', 'test-p']),
  entry('test_pp',    'testosterone', 'TEST PP',   1.5,  ['testosterone phenylpropionate', 'test phenylprop']),
  entry('test_enan',  'testosterone', 'TEST E',    4.5,  ['testosterone enanthate', 'test enanthate', 'test e', 'test-e', 'test enan']),
  entry('test_cyp',   'testosterone', 'TEST C',    8.0,  ['testosterone cypionate', 'testosterone cyp', 'test cyp', 'test c', 'test-c']),
  entry('test_undec', 'testosterone', 'TEST U',    21.0, ['testosterone undecanoate', 'nebido', 'aveed', 'test undecanoate']),
  entry('sustanon',   'testosterone', 'SUST',      7.0,  ['sustanon', 'omnadren', 'test blend', 'test mix']),
  entry('test',       'testosterone', 'TEST',      4.5,  ['testosterone', 'test']),
  // Nandrolone
  entry('npp',        'nandrolone',   'NPP',       2.7,  ['nandrolone phenylpropionate', 'npp', 'durabolin']),
  entry('deca',       'nandrolone',   'DECA',      7.0,  ['nandrolone decanoate', 'deca durabolin', 'deca', 'nandrolone']),
  // Trenbolone
  entry('tren_a',     'trenbolone',   'TREN A',    1.0,  ['trenbolone acetate', 'tren acetate', 'tren a', 'tren-a', 'finaplix']),
  entry('tren_e',     'trenbolone',   'TREN E',    5.0,  ['trenbolone enanthate', 'tren enanthate', 'tren e', 'tren-e']),
  entry('tren_hexa',  'trenbolone',   'PARA',      14.0, ['trenbolone hexahydrobenzylcarbonate', 'parabolan', 'tren hex']),
  entry('tren',       'trenbolone',   'TREN',      2.0,  ['trenbolone', 'tren']),
  // Drostanolone (Masteron)
  entry('mast_p',     'drostanolone', 'MAST P',    1.0,  ['drostanolone propionate', 'masteron propionate', 'mast prop', 'mast p']),
  entry('mast_e',     'drostanolone', 'MAST E',    5.0,  ['drostanolone enanthate', 'masteron enanthate', 'mast enanthate', 'mast e', 'masteron']),
  // Boldenone (EQ)
  entry('eq',         'boldenone',    'EQ',        14.0, ['boldenone undecylenate', 'boldenone', 'equipoise', 'eq']),
  // Methenolone (Primobolan)
  entry('primo_e',    'methenolone',  'PRIMO E',   7.0,  ['methenolone enanthate', 'primobolan enanthate', 'primo enanthate', 'primo e', 'primobolan', 'primo']),
  entry('primo_a',    'methenolone',  'PRIMO A',   0.25, ['methenolone acetate', 'primobolan acetate', 'oral primo']),
  // Stanozolol (Winstrol)
  entry('winstrol_inj','stanozolol',  'WINSTROL',  1.0,  ['stanozolol depot', 'winstrol depot', 'injectable winstrol', 'winstrol inj']),
  entry('winstrol',   'stanozolol',   'WINSTROL',  0.375,['stanozolol', 'winstrol', 'winny', 'stanazol']),
  // Oral non-esters
  entry('anavar',     'oxandrolone',  'ANAVAR',    0.375,['oxandrolone', 'anavar', 'var']),
  entry('dbol',       'methandro',    'DBOL',      0.21, ['methandrostenolone', 'methandienone', 'dianabol', 'dbol', 'd-bol', 'metandienone']),
  entry('anadrol',    'oxymetholone', 'ANADROL',   0.5,  ['oxymetholone', 'anadrol', 'a-bombs', 'oxy']),
  entry('proviron',   'mesterolone',  'PROVIRON',  0.5,  ['mesterolone', 'proviron']),
  entry('halo',       'fluoxy',       'HALO',      0.4,  ['fluoxymesterone', 'halotestin', 'halo']),
  // Ancillaries / peptides (logged but not androgens)
  entry('hcg',        'ancillary',    'HCG',       1.4,  ['hcg', 'human chorionic gonadotropin', 'pregnyl']),
  entry('hgh',        'ancillary',    'HGH',       0.15, ['somatropin', 'hgh', 'growth hormone', 'gh']),
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Resolve a free-text compound name to its built-in reference. Longest matching
 * alias wins (so "test e" beats the generic "test"). Unknown names get a
 * neutral default so the visual still renders a stream.
 */
export function lookup(name: string): CompoundInfo {
  const n = norm(name);
  let best: CompoundInfo | null = null;
  let bestLen = 0;
  for (const c of COMPOUNDS) {
    for (const a of c.aliases) {
      if ((n === a || n.includes(a)) && a.length > bestLen) { best = c; bestLen = a.length; }
    }
  }
  return best ?? {
    key: 'unknown', klass: 'Compound', shortLabel: name.slice(0, 8).toUpperCase() || 'CPD',
    halfLifeDays: 4, color: '#8a8a90', character: 'steady', aliases: [],
  };
}

/** Catalog for pickers / the agent — one row per common compound. */
export function catalog(): { label: string; klass: string; halfLifeDays: number }[] {
  return COMPOUNDS.filter((c) => c.key !== 'test') // hide the bare-family stand-ins from the menu
    .map((c) => ({ label: c.shortLabel, klass: c.klass, halfLifeDays: c.halfLifeDays }));
}
