// Central tuning. All distances/speeds are in *native* world pixels (pre-zoom).
// The camera zooms this up so 1 art-pixel becomes several screen pixels.

export const TILE = 16;
export const ZOOM = 3;

export const COLORS = {
  bg: 0x07060a,
  ash: 0x12101a,
  flag: 0xe0157a, // the one accent — reserved for genuine alerts only
  hpFull: 0x9a2a2a,
  hpBack: 0x2a0d0d,
  stamFull: 0x3f7d4f,
  stamBack: 0x10220f,
  text: 0xcfc7d6,
  textDim: 0x6b6478,
} as const;

export const PLAYER = {
  maxHp: 100,
  maxStamina: 100,
  walkSpeed: 72, // px/s
  rollSpeed: 230, // px/s during a roll
  rollDuration: 0.28, // s of movement
  rollIFrames: 0.22, // s of invulnerability inside the roll
  rollRecovery: 0.18, // s of lockout after the roll ends
  rollCost: 25,
  attackCost: 20,
  attackWindup: 0.1, // telegraph before the blade is live
  attackActive: 0.12, // blade deals damage
  attackRecovery: 0.22, // committed recovery — souls-like, no insta-cancel
  attackDamage: 34,
  attackReach: 22,
  attackArc: Math.PI * 0.9, // swing covers ~160°
  staminaRegen: 38, // per second
  staminaRegenDelay: 0.45, // s after spending before regen resumes
  knockback: 90,
  invulnAfterHit: 0.6,
} as const;

export const HOLLOW = {
  maxHp: 80,
  speed: 46,
  aggroRange: 150,
  attackRange: 22,
  attackWindup: 0.42, // long, readable telegraph — punishable
  attackActive: 0.12,
  attackRecovery: 0.5,
  attackDamage: 18,
  attackReach: 20,
  touchDamage: 0,
  knockbackTaken: 70,
  contactCooldown: 0.8,
} as const;
