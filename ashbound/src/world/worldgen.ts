import { BIOMES, type Biome } from "./biomes";
import type { TileIndex } from "../art/gen";
import { mulberry32, valueNoise } from "../art/util";

export interface PropPlacement {
  key: string;
  x: number;
  y: number;
  collide: boolean;
  body?: [number, number];
  tint?: number;
  glow?: boolean;
}
export interface EnemyPlacement {
  x: number;
  y: number;
  archetype: Biome["enemy"]["archetype"];
}
export interface Bonfire {
  x: number;
  y: number;
  biomeId: string;
  name: string;
}

export interface WorldData {
  cols: number;
  rows: number;
  tileSize: number;
  data: number[][];
  collide: number[];
  damaging: number[];
  biomeGrid: Uint8Array;
  props: PropPlacement[];
  enemies: EnemyPlacement[];
  bonfires: Bonfire[];
  playerStart: { x: number; y: number };
  boss: { x: number; y: number; gateX: number; gateY: number };
  biomeAt(px: number, py: number): Biome;
}

const COLS = 192;
const ROWS = 144;

// Zone anchors in normalised world space — their spatial layout IS the map.
const ANCHORS: Array<{ id: string; nx: number; ny: number }> = [
  { id: "palewood", nx: 0.34, ny: 0.16 },
  { id: "barrows", nx: 0.2, ny: 0.5 },
  { id: "ember", nx: 0.68, ny: 0.4 },
  { id: "mire", nx: 0.32, ny: 0.84 },
  { id: "cinderhold", nx: 0.85, ny: 0.74 },
];

export function generateWorld(tiles: TileIndex, seed = 1337): WorldData {
  const rng = mulberry32(seed);
  const warp = valueNoise(seed ^ 0x9e37);
  const waterN = valueNoise(seed ^ 0x51ed);
  const wallN = valueNoise(seed ^ 0x1234);

  const biomeIndexById = new Map(BIOMES.map((b, i) => [b.id, i]));
  const centers = ANCHORS.map((a) => ({
    i: biomeIndexById.get(a.id)!,
    x: a.nx * COLS,
    y: a.ny * ROWS,
  }));

  const biomeGrid = new Uint8Array(COLS * ROWS);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      let best = 0;
      let bestD = Infinity;
      const w = warp(tx * 0.06, ty * 0.06);
      for (const c of centers) {
        const dx = tx - c.x;
        const dy = ty - c.y;
        const d = Math.sqrt(dx * dx + dy * dy) * (0.78 + 0.5 * w);
        if (d < bestD) {
          bestD = d;
          best = c.i;
        }
      }
      biomeGrid[ty * COLS + tx] = best;
    }
  }

  const data: number[][] = [];
  const collide = new Set<number>([tiles.abyss]);
  const damaging = new Set<number>();
  const border = 2;

  for (let ty = 0; ty < ROWS; ty++) {
    const row: number[] = [];
    for (let tx = 0; tx < COLS; tx++) {
      const b = BIOMES[biomeGrid[ty * COLS + tx]];
      const bi = tiles.biome[b.id];
      // world rim is the abyss
      if (tx < border || ty < border || tx >= COLS - border || ty >= ROWS - border) {
        row.push(tiles.abyss);
        continue;
      }
      // ridge walls along biome borders (with noise gaps -> chokepoints)
      let bordering = false;
      if (
        biomeGrid[ty * COLS + tx - 1] !== biomeGrid[ty * COLS + tx] ||
        biomeGrid[ty * COLS + tx + 1] !== biomeGrid[ty * COLS + tx] ||
        biomeGrid[(ty - 1) * COLS + tx] !== biomeGrid[ty * COLS + tx] ||
        biomeGrid[(ty + 1) * COLS + tx] !== biomeGrid[ty * COLS + tx]
      ) {
        bordering = true;
      }
      if (bordering && wallN(tx * 0.25, ty * 0.25) > 0.62) {
        row.push(bi.cliff);
        collide.add(bi.cliff);
        continue;
      }
      // water / lava bodies
      const wn = waterN(tx * 0.09, ty * 0.09);
      if (wn < b.waterDensity) {
        row.push(bi.water);
        if (b.lava) damaging.add(bi.water);
        else collide.add(bi.water);
        continue;
      }
      // ground variant
      row.push(bi.ground[Math.floor(rng() * bi.ground.length)]);
    }
    data.push(row);
  }

  const px = (tx: number) => tx * tiles.tileSize + tiles.tileSize / 2;
  const groundAt = (tx: number, ty: number): boolean => {
    const b = BIOMES[biomeGrid[ty * COLS + tx]];
    const idx = data[ty][tx];
    const bi = tiles.biome[b.id];
    return idx !== bi.water && idx !== bi.cliff && idx !== tiles.abyss;
  };
  const clearArea = (tx: number, ty: number, rad: number): void => {
    for (let y = ty - rad; y <= ty + rad; y++) {
      for (let x = tx - rad; x <= tx + rad; x++) {
        if (x < border || y < border || x >= COLS - border || y >= ROWS - border) continue;
        const b = BIOMES[biomeGrid[y * COLS + x]];
        data[y][x] = tiles.biome[b.id].ground[0];
      }
    }
  };

  // Bonfires at each anchor; clear a plaza around them.
  const bonfires: Bonfire[] = [];
  for (const a of ANCHORS) {
    const tx = Math.round(a.nx * COLS);
    const ty = Math.round(a.ny * ROWS);
    clearArea(tx, ty, 3);
    const b = BIOMES[biomeIndexById.get(a.id)!];
    bonfires.push({ x: px(tx), y: px(ty), biomeId: a.id, name: b.name });
  }
  const start = bonfires.find((f) => f.biomeId === "barrows")!;

  // Boss arena in the cinderhold, north of its bonfire.
  const cAnchor = ANCHORS.find((a) => a.id === "cinderhold")!;
  const bossTx = Math.round(cAnchor.nx * COLS);
  const bossTy = Math.round(cAnchor.ny * ROWS) - 8;
  clearArea(bossTx, bossTy, 6);
  const boss = {
    x: px(bossTx),
    y: px(bossTy),
    gateX: px(bossTx),
    gateY: px(bossTy + 6),
  };

  // Props.
  const props: PropPlacement[] = [];
  const PROP_CAP = 1400;
  for (let ty = border; ty < ROWS - border && props.length < PROP_CAP; ty++) {
    for (let tx = border; tx < COLS - border; tx++) {
      if (!groundAt(tx, ty)) continue;
      const b = BIOMES[biomeGrid[ty * COLS + tx]];
      for (const p of b.props) {
        if (rng() < p.density) {
          props.push({
            key: p.key,
            x: px(tx) + (rng() - 0.5) * 8,
            y: px(ty) + (rng() - 0.5) * 8,
            collide: p.collide,
            body: p.body,
            tint: p.tintFoliage ? b.accent : undefined,
            glow: p.glow,
          });
          break; // one prop per cell
        }
      }
      if (props.length >= PROP_CAP) break;
    }
  }

  // Enemies, scattered through each biome away from its bonfire.
  const enemies: EnemyPlacement[] = [];
  for (const a of ANCHORS) {
    const b = BIOMES[biomeIndexById.get(a.id)!];
    let placed = 0;
    let guard = 0;
    while (placed < b.enemy.count && guard < b.enemy.count * 60) {
      guard++;
      const tx = border + Math.floor(rng() * (COLS - 2 * border));
      const ty = border + Math.floor(rng() * (ROWS - 2 * border));
      if (biomeGrid[ty * COLS + tx] !== biomeIndexById.get(a.id)) continue;
      if (!groundAt(tx, ty)) continue;
      const bx = px(tx);
      const by = px(ty);
      const near = bonfires.some((f) => Math.hypot(f.x - bx, f.y - by) < 90);
      if (near) continue;
      enemies.push({ x: bx, y: by, archetype: b.enemy.archetype });
      placed++;
    }
  }

  return {
    cols: COLS,
    rows: ROWS,
    tileSize: tiles.tileSize,
    data,
    collide: [...collide],
    damaging: [...damaging],
    biomeGrid,
    props,
    enemies,
    bonfires,
    playerStart: { x: start.x, y: start.y },
    boss,
    biomeAt(wx: number, wy: number): Biome {
      const tx = Math.max(0, Math.min(COLS - 1, Math.floor(wx / tiles.tileSize)));
      const ty = Math.max(0, Math.min(ROWS - 1, Math.floor(wy / tiles.tileSize)));
      return BIOMES[biomeGrid[ty * COLS + tx]];
    },
  };
}
