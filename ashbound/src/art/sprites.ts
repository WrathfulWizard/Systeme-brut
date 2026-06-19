import type { Palette } from "./pixelart";

// Shared palette. Deliberately desaturated + dark — a Blasphemous / Souls
// register. Each glyph is one colour; '.' is transparent.
export const PAL: Palette = {
  "#": 0x0a0810, // outline / near-black
  c: 0x241b2e, // cloak dark
  C: 0x342843, // cloak mid
  L: 0x463459, // cloak light
  s: 0xb9a892, // skin pale
  S: 0x8a7a68, // skin shadow
  e: 0x0d0814, // eye / hood recess
  r: 0x7a1f2b, // sash red (dark)
  R: 0xa83040, // sash red (bright)
  b: 0x171019, // boots / leather
  m: 0x8f96a3, // steel
  M: 0xc6ccd6, // steel highlight
  h: 0x5a3a24, // hilt leather
  g: 0x556152, // hollow flesh
  G: 0x6f7d68, // hollow flesh light
  k: 0x2c332a, // hollow dark
  y: 0xf2c14e, // ember yellow
  o: 0xd8702a, // ember orange
  n: 0xcfc6ad, // bone
  N: 0x9a917a, // bone shadow
  x: 0x2a2730, // stone dark
  X: 0x403c4a, // stone mid
  v: 0x565162, // stone light
  w: 0x3a2a1c, // wood dark
  W: 0x5a4630, // wood light
  t: 0x2f5d52, // moss
};

// ── Player: the Penitent ───────────────────────────────────────────────────
// Front (facing camera / "down"). 14x18. Frame 0 idle, 1-2 walk cycle.
const P_FRONT_IDLE = [
  "....####....",
  "...c####c...",
  "..cCLLLLCc..",
  "..cCsssCcc..",
  "..cseeessc..",
  "..cssssssc..",
  "...cSssSc...",
  "..cCLLLLCc..",
  ".cCLLLLLLCc.",
  ".cCLrRRrLCc.",
  ".cCLLLLLLCc.",
  ".cCLLLLLLCc.",
  ".cCCLLLLCCc.",
  "..cCC..CCc..",
  "..bb....bb..",
  "..bb....bb..",
  "..#b....b#..",
  "...#....#...",
];
const P_FRONT_A = [
  "....####....",
  "...c####c...",
  "..cCLLLLCc..",
  "..cCsssCcc..",
  "..cseeessc..",
  "..cssssssc..",
  "...cSssSc...",
  "..cCLLLLCc..",
  ".cCLLLLLLCc.",
  ".cCLrRRrLCc.",
  ".cCLLLLLLCc.",
  ".cCLLLLLLCc.",
  ".cCCLLLLCCc.",
  "..cCC..CCc..",
  "..bbb...bb..",
  "...bbb..bb..",
  "...#bb..b#..",
  "....#...#...",
];
const P_FRONT_B = [
  "....####....",
  "...c####c...",
  "..cCLLLLCc..",
  "..cCsssCcc..",
  "..cseeessc..",
  "..cssssssc..",
  "...cSssSc...",
  "..cCLLLLCc..",
  ".cCLLLLLLCc.",
  ".cCLrRRrLCc.",
  ".cCLLLLLLCc.",
  ".cCLLLLLLCc.",
  ".cCCLLLLCCc.",
  "..cCC..CCc..",
  "..bb...bbb..",
  "..bb..bbb...",
  "..#b..bb#...",
  "...#...#....",
];

// Back (facing away / "up"). No face; hood seam down the spine.
const P_BACK_IDLE = [
  "....####....",
  "...c####c...",
  "..cCLLLLCc..",
  "..cCLLLLCc..",
  "..cCLcLLCc..",
  "..cCLcLLCc..",
  "...cCLLCc...",
  "..cCLcLLCc..",
  ".cCLLcLLLCc.",
  ".cCLLcLLLCc.",
  ".cCLLcLLLCc.",
  ".cCLLcLLLCc.",
  ".cCCLLLLCCc.",
  "..cCC..CCc..",
  "..bb....bb..",
  "..bb....bb..",
  "..#b....b#..",
  "...#....#...",
];
const P_BACK_A = P_BACK_IDLE.map((r, i) =>
  i === 14 ? "..bbb...bb.." : i === 15 ? "...bbb..bb.." : i === 16 ? "...#bb..b#.." : r,
);
const P_BACK_B = P_BACK_IDLE.map((r, i) =>
  i === 14 ? "..bb...bbb.." : i === 15 ? "..bb..bbb..." : i === 16 ? "..#b..bb#..." : r,
);

// Side (facing right; flipX for left). Sword held low along the body.
const P_SIDE_IDLE = [
  "...####.....",
  "..c####c....",
  ".cCLLLLc....",
  ".cCsssCc....",
  ".cseessc....",
  ".cssssc.....",
  "..cSsSc.....",
  ".cCLLLCc....",
  ".cCLLLLCc.m.",
  ".cCLrRLCcMM.",
  ".cCLLLLChm..",
  ".cCLLLLCm...",
  ".cCCLLCCc...",
  "..cCLLCc....",
  "..bbbbb.....",
  "..bb.bb.....",
  "..#b.b#.....",
  "...#.#......",
];
const P_SIDE_A = P_SIDE_IDLE.map((r, i) =>
  i === 14 ? ".bbbb......." : i === 15 ? "bbb..bb...." : i === 16 ? "#b...b#...." : r,
);
const P_SIDE_B = P_SIDE_IDLE.map((r, i) =>
  i === 14 ? "...bbbb...." : i === 15 ? "...bb.bbb.." : i === 16 ? "...#b.b#..." : r,
);

// ── Hollow: the gaunt enemy ─────────────────────────────────────────────────
const H_FRONT_IDLE = [
  "...kkkk...",
  "..kgggggk.",
  "..kgyy gk.", // eyes blank out, see below
  "..kgggggk.",
  "...kgggk..",
  "..kkggkk..",
  ".kgggggggk",
  ".kgkgggkgk",
  ".kgkgggkgk",
  ".kggggggk.",
  "..kgkkgk..",
  "..kg..gk..",
  "..kg..gk..",
  "..kk..kk..",
  "..k#..#k..",
];
// patch the eye row to glowing embers
H_FRONT_IDLE[2] = "..kgyygk..";
const H_FRONT_A = H_FRONT_IDLE.map((r, i) =>
  i === 11 ? "..kgk.gk.." : i === 12 ? ".kg..gk..." : i === 13 ? ".kk..kk..." : i === 14 ? ".k#..#k..." : r,
);
const H_FRONT_B = H_FRONT_IDLE.map((r, i) =>
  i === 11 ? "..kg.kgk.." : i === 12 ? "..kg..gk.." : i === 13 ? "..kk..kkk." : i === 14 ? "..k#..#k#." : r,
);
const H_SIDE_IDLE = [
  "..kkkk....",
  ".kgggggk..",
  ".kgyygk...",
  ".kgggggk..",
  "..kgggk...",
  ".kkggkk...",
  "kgggggk...",
  "kgkggkgk..",
  "kgkggkgk..",
  ".kgggk....",
  "..kgkk....",
  "..kg.k....",
  "..kg.k....",
  "..kk.k....",
  "..k#.#....",
];
const H_SIDE_A = H_SIDE_IDLE.map((r, i) =>
  i === 11 ? "..kgk....." : i === 12 ? ".kg.k....." : i === 13 ? ".kk.k....." : r,
);
const H_SIDE_B = H_SIDE_IDLE.map((r, i) =>
  i === 11 ? "...kgk...." : i === 12 ? "...kg.k..." : i === 13 ? "...kk.k..." : r,
);

// ── Effects & props ─────────────────────────────────────────────────────────
// Slash crescent (points right; rotated toward facing at runtime). 18x18.
export const SLASH = [
  ".........MM.......",
  ".......MMMMm......",
  ".....MMm...mm.....",
  "....MM......mm....",
  "...Mm........m....",
  "..Mm.........mm...",
  "..M...........m...",
  ".Mm...........mm..",
  ".M.............m..",
  ".Mm...........mm..",
  "..M...........m...",
  "..Mm.........mm...",
  "...Mm........m....",
  "....MM......mm....",
  ".....MMm...mm.....",
  ".......MMMMm......",
  ".........MM.......",
  "..................",
];

// ── Mireling: the hunched beast ─────────────────────────────────────────────
const B_FRONT_IDLE = [
  "..k......k..",
  "..kk.kk.kk..",
  ".kgggggggk..",
  ".kgyGgGygk..",
  ".kgggggggk..",
  "kgGgggggGgk.",
  "kgkgggggkgk.",
  ".kgggggggk..",
  "..kk.k.kk...",
  "..k..k..k...",
];
const B_FRONT_A = B_FRONT_IDLE.map((r, i) =>
  i === 8 ? ".kk..k..kk.." : i === 9 ? ".k...k...k.." : r,
);
const B_FRONT_B = B_FRONT_IDLE.map((r, i) =>
  i === 8 ? "..kk.k.kk..." : i === 9 ? "...k.k.k...." : r,
);
const B_SIDE_IDLE = [
  ".kkk........",
  "kggggk......",
  "kgyGgkk.....",
  "kgggggk.....",
  "kgGgggggk...",
  "kgkgggggk...",
  ".kggggggk...",
  "..kg.gk.k...",
  "..k..k..k...",
];
const B_SIDE_A = B_SIDE_IDLE.map((r, i) =>
  i === 7 ? "..kgk.gk...." : i === 8 ? ".k..k..k...." : r,
);
const B_SIDE_B = B_SIDE_IDLE.map((r, i) =>
  i === 7 ? "...kg.k.gk.." : i === 8 ? "...k..k..k.." : r,
);

export const BEAST_FRAMES = {
  front: [B_FRONT_IDLE, B_FRONT_A, B_FRONT_B],
  side: [B_SIDE_IDLE, B_SIDE_A, B_SIDE_B],
};
// Ember / checkpoint, two flicker frames.
export const EMBER_A = [
  "....y.....",
  "...oyo....",
  "..oyyyo...",
  "..oyyoo...",
  "...ooo....",
  "..NnnnN...",
  ".NnwwwnN..",
  "NnwWWwwnN.",
  ".NnnnnnN..",
  "..NNNNN...",
];
export const EMBER_B = [
  "....y.....",
  "...yoy....",
  "..oyyoo...",
  "..oyooy...",
  "...ooo....",
  "..NnnnN...",
  ".NnwwwnN..",
  "NnwWWwwnN.",
  ".NnnnnnN..",
  "..NNNNN...",
];

export const PLAYER_FRAMES = {
  front: [P_FRONT_IDLE, P_FRONT_A, P_FRONT_B],
  back: [P_BACK_IDLE, P_BACK_A, P_BACK_B],
  side: [P_SIDE_IDLE, P_SIDE_A, P_SIDE_B],
};
export const HOLLOW_FRAMES = {
  front: [H_FRONT_IDLE, H_FRONT_A, H_FRONT_B],
  side: [H_SIDE_IDLE, H_SIDE_A, H_SIDE_B],
};
