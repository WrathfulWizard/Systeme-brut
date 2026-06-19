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
};

export function flash(now: number, text: string, ms = 2200): void {
  playerState.message = text;
  playerState.messageUntil = now + ms;
}
