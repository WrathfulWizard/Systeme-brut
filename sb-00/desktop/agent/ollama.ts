import { getSetting, setSetting } from '../db/mutations';
import { buildContext, SYSTEM_PROMPT } from './context';
import type { AgentStatus, ChatMessage } from '../../lib/types';

/**
 * SB-Σ runs on a LOCAL model via Ollama — nothing leaves the machine. The
 * operator's data is sensitive (PED protocol, labs), so privacy is the whole
 * point of this choice. We talk to Ollama's HTTP API on localhost.
 */

function cfg() {
  return {
    url: getSetting('agent_url') || 'http://127.0.0.1:11434',
    model: getSetting('agent_model') || '',
  };
}

/** Probe Ollama: is it running, what models are installed, which is selected? */
export async function agentStatus(): Promise<AgentStatus> {
  const { url, model } = cfg();
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
    const j = (await res.json()) as { models?: { name: string }[] };
    const models = (j.models ?? []).map((m) => m.name);
    const selected = model && models.includes(model) ? model : models[0] ?? '';
    if (selected && selected !== model) setSetting('agent_model', selected);
    return { provider: 'ollama', url, reachable: true, models, model: selected };
  } catch (e) {
    return { provider: 'ollama', url, reachable: false, models: [], model, error: (e as Error).message };
  }
}

export function setAgentModel(model: string): Promise<AgentStatus> {
  setSetting('agent_model', model);
  return agentStatus();
}

export interface StreamHandlers {
  onToken: (chunk: string) => void;
  onDone: (full: string) => void;
  onError: (message: string) => void;
}

/**
 * Stream a chat completion. The current hub snapshot is injected as context on
 * every call, so SB-Σ always reasons over live data. `messages` is the running
 * conversation (user/assistant turns) from the renderer.
 */
export async function agentChat(messages: ChatMessage[], h: StreamHandlers): Promise<void> {
  const { url, model } = cfg();
  if (!model) { h.onError('No local model selected. Install one with `ollama pull llama3.1` and pick it on Connections.'); return; }

  const payload = {
    model,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `CURRENT HUB STATE:\n${buildContext()}` },
      ...messages,
    ],
  };

  let full = '';
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) throw new Error(`Ollama chat failed (${res.status})`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const obj = JSON.parse(t) as { message?: { content?: string }; done?: boolean; error?: string };
          if (obj.error) throw new Error(obj.error);
          const piece = obj.message?.content ?? '';
          if (piece) { full += piece; h.onToken(piece); }
        } catch { /* ignore partial/non-JSON keepalive lines */ }
      }
    }
    h.onDone(full);
  } catch (e) {
    h.onError((e as Error).message);
  }
}

/** Proactive once-over — SB-Σ reviews the hub unprompted and flags what stands out. */
export function agentReview(h: StreamHandlers): Promise<void> {
  return agentChat(
    [{ role: 'user', content: 'Review my current state across all three nodes. Give me your top 2-3 observations or challenges, most important first. Be specific to my numbers.' }],
    h,
  );
}
