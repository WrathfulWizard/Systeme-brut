import type { StartupReview } from '../../lib/types';
import { agentStatus, generateReviewText } from './ollama';

/**
 * The launch briefing — SB-Σ reviews the whole hub once at startup so a full
 * review is already waiting when the boot sequence finishes. Held in memory for
 * the life of the process (it's a snapshot of "now at launch"); the renderer
 * reads it via IPC and the boot splash holds until it resolves.
 */

let current: StartupReview = { status: 'pending' };
let notify: ((r: StartupReview) => void) | null = null;

export function startupReview(): StartupReview { return current; }
export function onStartupReview(cb: (r: StartupReview) => void) { notify = cb; }

function set(r: StartupReview) { current = r; notify?.(r); }

/**
 * Generate the briefing. `up` is whether Ollama is reachable. Resolves to a
 * terminal state (ready/unavailable) and never throws — the boot must always
 * be released. When no agent/model is available this launch we mark it
 * `unavailable` so the boot proceeds immediately instead of hanging.
 */
export async function runStartupReview(up: boolean): Promise<void> {
  if (!up) { set({ status: 'unavailable', error: 'Ollama offline' }); return; }
  try {
    const st = await agentStatus();
    if (!st.model) { set({ status: 'unavailable', error: 'No model installed yet' }); return; }
    const text = await generateReviewText();
    set({ status: 'ready', text, at: new Date().toISOString() });
  } catch (e) {
    set({ status: 'unavailable', error: (e as Error).message });
  }
}
