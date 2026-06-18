import { getSetting, setSetting, addAgentFlags, type AgentFlag } from '../db/mutations';
import { buildContext, SYSTEM_PROMPT } from './context';
import type { AgentStatus, ChatMessage, SweepResult } from '../../lib/types';

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
    if (!res.ok || !res.body) {
      // Surface Ollama's own message (e.g. "model requires more system memory")
      // instead of a bare status code — a 500 here is almost always the model
      // failing to load, and the operator needs to know why.
      const detail = await res.text().catch(() => '');
      const parsed = detail && (() => { try { return JSON.parse(detail).error as string; } catch { return ''; } })();
      throw new Error(`Ollama chat failed (${res.status})${parsed || detail ? ` — ${parsed || detail.slice(0, 300)}` : ''}`);
    }

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

/* ---- Sweep: SB-Σ raises persistent flags ---------------------------------
 * Unlike Review (which streams prose into the chat), Sweep asks the model for
 * a STRUCTURED verdict and writes the results into the Flags feed, where they
 * persist until you clear them. Selective by design — it should say nothing
 * when nothing is wrong. */

const SWEEP_PROMPT = `${SYSTEM_PROMPT}

SWEEP MODE — you are auditing the hub to raise FLAGS, not to chat.
Surface only what genuinely warrants attention right now: a stall, an unjustified dose change, a lab value out of range, a dietary gap, an ignored trend. Be selective — 0 to 4 flags, most important only. Do NOT flag things that are fine, and do NOT restate flags already listed under OPEN FLAGS.

Respond with ONLY a JSON object, no prose, no markdown:
{"flags":[{"key":"<short-stable-slug>","severity":"flag"|"info","nodes":["pharmacology"|"training"|"cardio"|"nutrition"],"body":"<one sharp sentence, specific to the operator's numbers>"}]}
"key" must be a stable slug for the issue (e.g. "tren-dose-unjustified") so the same flag isn't raised twice. If nothing warrants a flag, return {"flags":[]}.`;

/** Coerce a model's reply into AgentFlag[], tolerating fences / arrays / stray prose. */
function parseFlags(raw: string): AgentFlag[] {
  let txt = (raw ?? '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) txt = fence[1].trim();
  let data: unknown;
  try { data = JSON.parse(txt); }
  catch {
    const m = txt.match(/[[{][\s\S]*[\]}]/);
    if (!m) return [];
    try { data = JSON.parse(m[0]); } catch { return []; }
  }
  const arr = Array.isArray(data) ? data
    : Array.isArray((data as { flags?: unknown }).flags) ? (data as { flags: unknown[] }).flags
    : [];
  return (arr as Record<string, unknown>[])
    .filter((f) => f && typeof f.body === 'string' && (f.body as string).trim())
    .map((f) => ({
      severity: f.severity === 'info' ? 'info' : 'flag',
      body: String(f.body).trim(),
      nodes: Array.isArray(f.nodes) ? (f.nodes as unknown[]).map(String) : [],
      key: typeof f.key === 'string' && f.key.trim() ? f.key.trim() : String(f.body).trim(),
    }));
}

export async function agentSweep(): Promise<SweepResult> {
  const { url, model } = cfg();
  if (!model) return { ran: false, created: 0, considered: 0, error: 'No local model selected. Pull one with `ollama pull llama3.1` and pick it on Connections.' };
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model, stream: false, format: 'json', options: { temperature: 0.2 },
        messages: [
          { role: 'system', content: SWEEP_PROMPT },
          { role: 'user', content: `HUB STATE:\n${buildContext()}\n\nReturn the JSON object of flags now.` },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const parsed = detail && (() => { try { return JSON.parse(detail).error as string; } catch { return ''; } })();
      return { ran: false, created: 0, considered: 0, error: `Ollama sweep failed (${res.status})${parsed || detail ? ` — ${parsed || detail.slice(0, 200)}` : ''}` };
    }
    const j = (await res.json()) as { message?: { content?: string } };
    const flags = parseFlags(j.message?.content ?? '');
    const created = addAgentFlags(flags);
    return { ran: true, created, considered: flags.length };
  } catch (e) {
    return { ran: false, created: 0, considered: 0, error: (e as Error).message };
  }
}

/** Proactive once-over — SB-Σ reviews the hub unprompted and flags what stands out. */
export function agentReview(h: StreamHandlers): Promise<void> {
  return agentChat(
    [{ role: 'user', content: 'Review my current state across all three nodes. Give me your top 2-3 observations or challenges, most important first. Be specific to my numbers.' }],
    h,
  );
}
