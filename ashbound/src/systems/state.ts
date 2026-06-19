// Mutable snapshot the HUD reads each frame. Gameplay writes; UI reads. Keeps
// the UIScene decoupled from entity internals without event spaghetti.
export interface PlayerState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  lockedOn: boolean;
  dead: boolean;
  enemiesLeft: number;
  message: string;
  messageUntil: number; // scene time (ms) the banner clears
  // RPG progression
  runes: number;
  lostRunes: number; // recoverable bloodstain pile
  level: number;
  estus: number;
  estusMax: number;
  zone: string; // current zone title
  // zone title card
  zoneTitle: string;
  zoneSub: string;
  zoneUntil: number;
  // boss bar
  bossName: string;
  bossFrac: number; // <0 = hidden
  // bonfire menu
  menuOpen: boolean;
  menuOptions: string[];
  menuIndex: number;
  prompt: string; // contextual "[E] rest" hint
  // pause
  paused: boolean;
  pauseIndex: number;
  // overlays (drawn by the unzoomed HUD scene)
  ambientColor: number;
  ambientAlpha: number;
  mmX: number; // player position on the minimap, normalised 0..1
  mmY: number;
}

export const playerState: PlayerState = {
  hp: 100,
  maxHp: 100,
  stamina: 100,
  maxStamina: 100,
  lockedOn: false,
  dead: false,
  enemiesLeft: 0,
  message: "",
  messageUntil: 0,
  runes: 0,
  lostRunes: 0,
  level: 1,
  estus: 4,
  estusMax: 4,
  zone: "",
  zoneTitle: "",
  zoneSub: "",
  zoneUntil: 0,
  bossName: "",
  bossFrac: -1,
  menuOpen: false,
  menuOptions: [],
  menuIndex: 0,
  prompt: "",
  paused: false,
  pauseIndex: 0,
  ambientColor: 0x000000,
  ambientAlpha: 0,
  mmX: 0,
  mmY: 0,
};

export const PAUSE_OPTIONS = ["Resume", "Return to title"];

export interface MinimapData {
  cols: number;
  rows: number;
  bonfires: { nx: number; ny: number }[];
  boss: { nx: number; ny: number };
}

export function zoneCard(now: number, title: string, sub: string, ms = 3200): void {
  playerState.zoneTitle = title;
  playerState.zoneSub = sub;
  playerState.zoneUntil = now + ms;
}

export function flash(now: number, text: string, ms = 2200): void {
  playerState.message = text;
  playerState.messageUntil = now + ms;
}
