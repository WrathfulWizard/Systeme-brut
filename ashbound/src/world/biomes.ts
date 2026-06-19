// The five regions of the Ashbound world. Each biome drives its own ground
// art, props, enemies, ambient colour grade and lore. Palettes are deliberately
// distinct so a glance tells you where you are — Elden-Ring legibility.

export type DetailKind = "ash" | "grass" | "ember" | "mire" | "stone";

export interface PropSpec {
  key: string; // generated prop texture key
  density: number; // chance per eligible ground cell
  collide: boolean;
  body?: [number, number]; // collision box at the base
  tintFoliage?: boolean; // recolour to the biome accent (trees/grass/etc.)
  glow?: boolean; // emits a soft light sprite
}

export interface BiomeEnemy {
  archetype: "hollow" | "mireling" | "emberknight";
  count: number;
}

export interface Biome {
  id: string;
  name: string; // zone title card
  subtitle: string;
  lore: string;
  ground: number[]; // 3 base tones
  speckDark: number;
  speckLight: number;
  detail: DetailKind;
  accent: number; // glow / foliage tint
  water: number;
  lava: boolean; // water tiles are lava (damaging, glowing)
  waterDensity: number; // 0 = none, higher = more pools/rivers
  cliff: number;
  ambient: number; // camera colour-grade overlay
  ambientAlpha: number;
  fog: number; // 0..1 drifting fog density
  props: PropSpec[];
  enemy: BiomeEnemy;
  rest: boolean; // has a bonfire ember
}

const PILLAR: PropSpec = { key: "p_pillar", density: 0.006, collide: true, body: [8, 5] };
const WALL: PropSpec = { key: "p_wall", density: 0.004, collide: true, body: [14, 6] };
const GRAVE: PropSpec = { key: "p_grave", density: 0.012, collide: false };
const ROCK: PropSpec = { key: "p_rock", density: 0.02, collide: false };
const BOULDER: PropSpec = { key: "p_boulder", density: 0.006, collide: true, body: [12, 7] };
const BONES: PropSpec = { key: "p_bones", density: 0.01, collide: false };

export const BIOMES: Biome[] = [
  {
    id: "barrows",
    name: "Ashen Barrows",
    subtitle: "where the first of us were buried",
    lore: "A field of cairns under a colourless sky. The dead here do not rest; they only forget. You woke among them.",
    ground: [0x15131c, 0x191622, 0x12101a],
    speckDark: 0x0d0b14,
    speckLight: 0x231f30,
    detail: "ash",
    accent: 0x7a6a9a,
    water: 0x1a2433,
    lava: false,
    waterDensity: 0.06,
    cliff: 0x33303d,
    ambient: 0x1a1626,
    ambientAlpha: 0.12,
    fog: 0.16,
    props: [GRAVE, { ...GRAVE, key: "p_deadtree", density: 0.01, collide: true, body: [4, 4] }, ROCK, BONES, PILLAR],
    enemy: { archetype: "hollow", count: 8 },
    rest: true,
  },
  {
    id: "mire",
    name: "The Mireheart",
    subtitle: "drowned, and dreaming still",
    lore: "Black water without a floor. Things move below the reeds that were once pilgrims. The Mire remembers every step you take.",
    ground: [0x14201a, 0x18261d, 0x101c16],
    speckDark: 0x0a140f,
    speckLight: 0x24382a,
    detail: "mire",
    accent: 0x4f7d3f,
    water: 0x16241e,
    lava: false,
    waterDensity: 0.34,
    cliff: 0x2c3330,
    ambient: 0x13241a,
    ambientAlpha: 0.18,
    fog: 0.24,
    props: [
      { key: "p_reeds", density: 0.05, collide: false, tintFoliage: true },
      { key: "p_deadtree", density: 0.02, collide: true, body: [4, 4], tintFoliage: true },
      { key: "p_mushroom", density: 0.02, collide: false, glow: true, tintFoliage: true },
      ROCK,
    ],
    enemy: { archetype: "mireling", count: 10 },
    rest: true,
  },
  {
    id: "ember",
    name: "Emberreach Highlands",
    subtitle: "the forge that would not die",
    lore: "Basalt terraces bleeding fire. Smiths beat their last blades here when the world cooled; their hands never stopped. The heat is a kind of grief.",
    ground: [0x1b1414, 0x211616, 0x171010],
    speckDark: 0x0e0808,
    speckLight: 0x3a2420,
    detail: "ember",
    accent: 0xd8702a,
    water: 0x4a1c0e,
    lava: true,
    waterDensity: 0.18,
    cliff: 0x2e2422,
    ambient: 0x241410,
    ambientAlpha: 0.16,
    fog: 0.1,
    props: [
      { key: "p_embervent", density: 0.014, collide: false, glow: true },
      BOULDER,
      ROCK,
      { ...PILLAR, key: "p_obelisk", density: 0.005 },
    ],
    enemy: { archetype: "emberknight", count: 8 },
    rest: true,
  },
  {
    id: "palewood",
    name: "The Palewood",
    subtitle: "lanterns that were never lit by hands",
    lore: "A forest lit from within. The pale trees lean toward anything still warm. Pilgrims walked in and became the lights you see between the trunks.",
    ground: [0x121a22, 0x16202a, 0x0e1620],
    speckDark: 0x0a1018,
    speckLight: 0x20303c,
    detail: "grass",
    accent: 0x3fa8c0,
    water: 0x122430,
    lava: false,
    waterDensity: 0.12,
    cliff: 0x2a323c,
    ambient: 0x0e1a24,
    ambientAlpha: 0.2,
    fog: 0.22,
    props: [
      { key: "p_pine", density: 0.05, collide: true, body: [5, 4], tintFoliage: true },
      { key: "p_mushroom", density: 0.03, collide: false, glow: true, tintFoliage: true },
      ROCK,
      { key: "p_stump", density: 0.008, collide: true, body: [7, 4] },
    ],
    enemy: { archetype: "mireling", count: 9 },
    rest: true,
  },
  {
    id: "cinderhold",
    name: "The Cinderhold",
    subtitle: "the last throne, and what sits upon it",
    lore: "A fortress of black flagstone where the Cinder Lord keeps the world's final flame. End here, or end everywhere.",
    ground: [0x1c1a20, 0x222026, 0x18161c],
    speckDark: 0x100e14,
    speckLight: 0x34313c,
    detail: "stone",
    accent: 0xb04030,
    water: 0x14161c,
    lava: false,
    waterDensity: 0.04,
    cliff: 0x3a3742,
    ambient: 0x161420,
    ambientAlpha: 0.16,
    fog: 0.14,
    props: [WALL, PILLAR, { key: "p_banner", density: 0.01, collide: false }, BONES, BOULDER],
    enemy: { archetype: "emberknight", count: 6 },
    rest: true,
  },
];

export const BIOME_BY_ID: Record<string, Biome> = Object.fromEntries(
  BIOMES.map((b) => [b.id, b]),
);
