/**
 * Built-in pharmacology reference — the "most common compounds" the hub reasons
 * over. Each entry carries an ESTIMATED elimination/release half-life (the
 * rate-limiting ester depot half-life, in days), the visual identity (colour +
 * flow "character") used by the Serum Dynamics visual, and a form/category so
 * the UI can split injectables (the protocol board) from orals & supplements.
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
export type Form = 'injectable' | 'oral';
export type Category = 'aas' | 'ancillary' | 'peptide' | 'support';

export interface CompoundInfo {
  key: string;            // canonical key
  klass: string;          // family label shown in UI
  shortLabel: string;     // terse readout label, e.g. "TEST E"
  halfLifeDays: number;   // estimated elimination / depot-release half-life
  color: string;          // hex — the stream's colour in the visual
  character: Character;    // flow personality in the visual
  form: Form;             // injectable | oral
  category: Category;     // aas | ancillary | peptide | support
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
  dhb:          { klass: 'Dihydroboldenone', color: '#7fa86b', character: 'confident' as Character },
  ment:         { klass: 'Trestolone',   color: '#e0617a', character: 'oscillating' as Character },
  stanozolol:   { klass: 'Stanozolol',   color: '#d7d2c4', character: 'confident' as Character },
  oxandrolone:  { klass: 'Oxandrolone',  color: '#d8c074', character: 'steady' as Character },
  methandro:    { klass: 'Methandienone',color: '#b5562f', character: 'saturated' as Character },
  oxymetholone: { klass: 'Oxymetholone', color: '#8e4b2a', character: 'saturated' as Character },
  mesterolone:  { klass: 'Mesterolone',  color: '#b9a06a', character: 'steady' as Character },
  fluoxy:       { klass: 'Fluoxymesterone', color: '#c2563a', character: 'oscillating' as Character },
  turinabol:    { klass: 'Chlorodehydromethyltest', color: '#a8b27a', character: 'steady' as Character },
  superdrol:    { klass: 'Methasterone',  color: '#9d4f3a', character: 'saturated' as Character },
  ancillary:    { klass: 'Ancillary',    color: '#6f8fd6', character: 'steady' as Character },
  peptide:      { klass: 'Peptide',      color: '#7ad0c0', character: 'steady' as Character },
  ai:           { klass: 'Aromatase inhibitor', color: '#8a7fd6', character: 'steady' as Character },
  serm:         { klass: 'SERM',         color: '#b07fd6', character: 'steady' as Character },
  support:      { klass: 'Support',      color: '#6f8fa0', character: 'steady' as Character },
} as const;

type Fam = keyof typeof FAMILY;

function entry(
  key: string, fam: Fam, shortLabel: string, halfLifeDays: number,
  form: Form, category: Category, aliases: string[],
): CompoundInfo {
  return { key, ...FAMILY[fam], shortLabel, halfLifeDays, form, category, aliases };
}

// ---- INJECTABLE anabolics (the protocol board) ---------------------------
const INJECTABLE: CompoundInfo[] = [
  // Testosterone esters
  entry('test_susp',  'testosterone', 'TEST SUS',  0.5,  'injectable', 'aas', ['testosterone suspension', 'test suspension', 'test base', 'test no ester', 'aquaviron']),
  entry('test_prop',  'testosterone', 'TEST P',    0.8,  'injectable', 'aas', ['testosterone propionate', 'test prop', 'test p', 'test-p']),
  entry('test_pp',    'testosterone', 'TEST PP',   1.5,  'injectable', 'aas', ['testosterone phenylpropionate', 'test phenylprop']),
  entry('test_iso',   'testosterone', 'TEST ISO',  4.0,  'injectable', 'aas', ['testosterone isocaproate', 'test iso']),
  entry('test_enan',  'testosterone', 'TEST E',    4.5,  'injectable', 'aas', ['testosterone enanthate', 'test enanthate', 'test e', 'test-e', 'test enan']),
  entry('test_cyp',   'testosterone', 'TEST C',    8.0,  'injectable', 'aas', ['testosterone cypionate', 'testosterone cyp', 'test cyp', 'test c', 'test-c']),
  entry('test_dec',   'testosterone', 'TEST D',    15.0, 'injectable', 'aas', ['testosterone decanoate', 'test decanoate', 'test deca ester']),
  entry('test_undec', 'testosterone', 'TEST U',    21.0, 'injectable', 'aas', ['testosterone undecanoate', 'nebido', 'aveed', 'test undecanoate']),
  entry('sustanon',   'testosterone', 'SUST',      7.0,  'injectable', 'aas', ['sustanon', 'omnadren', 'test blend', 'test mix', 'sust 250']),
  entry('test',       'testosterone', 'TEST',      4.5,  'injectable', 'aas', ['testosterone', 'test']),
  // Nandrolone
  entry('npp',        'nandrolone',   'NPP',       2.7,  'injectable', 'aas', ['nandrolone phenylpropionate', 'npp', 'durabolin']),
  entry('deca',       'nandrolone',   'DECA',      7.0,  'injectable', 'aas', ['nandrolone decanoate', 'deca durabolin', 'deca', 'nandrolone']),
  // Trenbolone
  entry('tren_a',     'trenbolone',   'TREN A',    1.0,  'injectable', 'aas', ['trenbolone acetate', 'tren acetate', 'tren a', 'tren-a', 'finaplix']),
  entry('tren_e',     'trenbolone',   'TREN E',    5.0,  'injectable', 'aas', ['trenbolone enanthate', 'tren enanthate', 'tren e', 'tren-e']),
  entry('tren_hexa',  'trenbolone',   'PARA',      14.0, 'injectable', 'aas', ['trenbolone hexahydrobenzylcarbonate', 'parabolan', 'tren hex']),
  entry('tren',       'trenbolone',   'TREN',      2.0,  'injectable', 'aas', ['trenbolone', 'tren']),
  // Drostanolone (Masteron)
  entry('mast_p',     'drostanolone', 'MAST P',    1.0,  'injectable', 'aas', ['drostanolone propionate', 'masteron propionate', 'mast prop', 'mast p']),
  entry('mast_e',     'drostanolone', 'MAST E',    5.0,  'injectable', 'aas', ['drostanolone enanthate', 'masteron enanthate', 'mast enanthate', 'mast e', 'masteron']),
  // Boldenone (EQ)
  entry('eq',         'boldenone',    'EQ',        14.0, 'injectable', 'aas', ['boldenone undecylenate', 'boldenone', 'equipoise', 'eq']),
  entry('bold_cyp',   'boldenone',    'BOLD C',    8.0,  'injectable', 'aas', ['boldenone cypionate', 'bold cyp']),
  // Methenolone (Primobolan, injectable enanthate)
  entry('primo_e',    'methenolone',  'PRIMO E',   7.0,  'injectable', 'aas', ['methenolone enanthate', 'primobolan enanthate', 'primo enanthate', 'primo e', 'primobolan depot', 'primo depot']),
  // 1-Testosterone / DHB
  entry('dhb',        'dhb',          'DHB',       3.0,  'injectable', 'aas', ['dihydroboldenone', '1-testosterone', '1 testosterone', 'dhb', 'pheraplex inj']),
  // Trestolone (MENT)
  entry('ment',       'ment',         'MENT',      0.7,  'injectable', 'aas', ['trestolone acetate', 'ment', '7-alpha-methyl-19-nortestosterone']),
  // Stanozolol depot (injectable winstrol)
  entry('winstrol_inj','stanozolol',  'WINSTROL',  1.0,  'injectable', 'aas', ['stanozolol depot', 'winstrol depot', 'injectable winstrol', 'winstrol inj']),
];

// ---- INJECTABLE ancillaries / peptides -----------------------------------
const INJECTABLE_ANCILLARY: CompoundInfo[] = [
  entry('hcg',        'ancillary',    'HCG',       1.4,  'injectable', 'ancillary', ['hcg', 'human chorionic gonadotropin', 'pregnyl', 'ovidrel']),
  entry('hmg',        'ancillary',    'HMG',       0.6,  'injectable', 'ancillary', ['hmg', 'menotropin', 'menopur']),
  entry('hgh',        'peptide',      'HGH',       0.15, 'injectable', 'peptide',   ['somatropin', 'hgh', 'growth hormone', 'gh']),
  entry('igf1',       'peptide',      'IGF-1',     0.5,  'injectable', 'peptide',   ['igf-1', 'igf1', 'igf-1 lr3', 'mechano growth']),
  entry('bpc157',     'peptide',      'BPC-157',   0.17, 'injectable', 'peptide',   ['bpc-157', 'bpc 157', 'bpc157']),
  entry('tb500',      'peptide',      'TB-500',    1.5,  'injectable', 'peptide',   ['tb-500', 'tb 500', 'thymosin beta']),
  entry('cjc1295',    'peptide',      'CJC-1295',  0.3,  'injectable', 'peptide',   ['cjc-1295', 'cjc 1295', 'cjc1295']),
  entry('ipamorelin', 'peptide',      'IPAMORELIN',0.08, 'injectable', 'peptide',   ['ipamorelin']),
];

// ---- ORAL anabolics ------------------------------------------------------
const ORAL_AAS: CompoundInfo[] = [
  entry('anavar',     'oxandrolone',  'ANAVAR',    0.375,'oral', 'aas', ['oxandrolone', 'anavar', 'var']),
  entry('dbol',       'methandro',    'DBOL',      0.21, 'oral', 'aas', ['methandrostenolone', 'methandienone', 'dianabol', 'dbol', 'd-bol', 'metandienone']),
  entry('anadrol',    'oxymetholone', 'ANADROL',   0.5,  'oral', 'aas', ['oxymetholone', 'anadrol', 'a-bombs', 'oxy']),
  entry('winstrol',   'stanozolol',   'WINSTROL',  0.375,'oral', 'aas', ['stanozolol', 'winstrol', 'winny', 'stanazol']),
  entry('proviron',   'mesterolone',  'PROVIRON',  0.5,  'oral', 'aas', ['mesterolone', 'proviron']),
  entry('halo',       'fluoxy',       'HALO',      0.4,  'oral', 'aas', ['fluoxymesterone', 'halotestin', 'halo']),
  entry('tbol',       'turinabol',    'TBOL',      0.67, 'oral', 'aas', ['turinabol', 'tbol', 'oral turinabol', 'chlorodehydromethyltestosterone', '4-chlorodehydromethyltestosterone']),
  entry('superdrol',  'superdrol',    'SUPERDROL', 0.5,  'oral', 'aas', ['methasterone', 'superdrol', 'methyldrostanolone', 'sdrol']),
  entry('primo_a',    'methenolone',  'PRIMO A',   0.25, 'oral', 'aas', ['methenolone acetate', 'primobolan acetate', 'oral primo', 'primo a']),
];

// ---- SUPPORT / supplements (AIs, SERMs, cialis, accutane, etc.) ----------
const SUPPORT: CompoundInfo[] = [
  // Aromatase inhibitors
  entry('aromasin',   'ai',           'AROMASIN',  1.0,  'oral', 'support', ['exemestane', 'aromasin']),
  entry('arimidex',   'ai',           'ARIMIDEX',  2.0,  'oral', 'support', ['anastrozole', 'arimidex', 'adex']),
  entry('letro',      'ai',           'LETRO',     2.0,  'oral', 'support', ['letrozole', 'letro', 'femara']),
  // SERMs
  entry('nolva',      'serm',         'NOLVA',     5.5,  'oral', 'support', ['tamoxifen', 'nolvadex', 'nolva']),
  entry('clomid',     'serm',         'CLOMID',    5.0,  'oral', 'support', ['clomiphene', 'clomid', 'clomifene']),
  entry('enclomiphene','serm',        'ENCLOMI',   4.0,  'oral', 'support', ['enclomiphene', 'enclomi']),
  // 5-AR inhibitors
  entry('finasteride','support',      'FINAST',    0.27, 'oral', 'support', ['finasteride', 'propecia', 'proscar', 'fin']),
  entry('dutasteride','support',      'DUTAST',    35.0, 'oral', 'support', ['dutasteride', 'avodart', 'dut']),
  // ED / vasodilators
  entry('cialis',     'support',      'CIALIS',    0.73, 'oral', 'support', ['tadalafil', 'cialis']),
  entry('viagra',     'support',      'VIAGRA',    0.17, 'oral', 'support', ['sildenafil', 'viagra']),
  // Prolactin
  entry('caber',      'support',      'CABER',     2.6,  'oral', 'support', ['cabergoline', 'caber', 'dostinex']),
  entry('prami',      'support',      'PRAMI',     0.33, 'oral', 'support', ['pramipexole', 'prami']),
  // Skin / metabolic / BP
  entry('accutane',   'support',      'ACCUTANE',  0.88, 'oral', 'support', ['isotretinoin', 'accutane', 'roaccutane', 'tane']),
  entry('telmisartan','support',      'TELMI',     1.0,  'oral', 'support', ['telmisartan', 'telmi', 'micardis']),
  entry('metformin',  'support',      'METFORMIN', 0.27, 'oral', 'support', ['metformin', 'glucophage']),
  entry('semaglutide','support',      'SEMA',      7.0,  'oral', 'support', ['semaglutide', 'ozempic', 'wegovy', 'sema']),
];

export const COMPOUNDS: CompoundInfo[] = [
  ...INJECTABLE, ...INJECTABLE_ANCILLARY, ...ORAL_AAS, ...SUPPORT,
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
    halfLifeDays: 4, color: '#8a8a90', character: 'steady', form: 'injectable', category: 'aas', aliases: [],
  };
}

export interface CatalogRow { label: string; klass: string; halfLifeDays: number; form: Form; category: Category; }
const toRow = (c: CompoundInfo): CatalogRow => ({ label: c.shortLabel, klass: c.klass, halfLifeDays: c.halfLifeDays, form: c.form, category: c.category });

/** Catalog for pickers / the agent — one row per common compound. */
export function catalog(): CatalogRow[] {
  return COMPOUNDS.filter((c) => c.key !== 'test').map(toRow);
}
/** Injectable anabolics + ancillaries — the protocol board picker. */
export function injectableCatalog(): CatalogRow[] {
  return COMPOUNDS.filter((c) => c.form === 'injectable' && c.key !== 'test').map(toRow);
}
/** Orals + supplements (cialis, accutane, AIs, SERMs…) — the support picker. */
export function oralCatalog(): CatalogRow[] {
  return COMPOUNDS.filter((c) => c.form === 'oral').map(toRow);
}
