'use client';

import { useEffect, useRef, useState } from 'react';
import HubFrame from '@/components/HubFrame';
import { useSb } from './providers';
import type { ModelPullStatus } from '@/lib/types';

const STARTERS = [
  'Review my current state.',
  'Is my current protocol justified by my labs?',
  'Where am I stalling?',
  'What should I log next?',
];

export default function Sigma() {
  const { agent, refreshAgent, isDesktop, sweep, modelPull,
    chat, chatStreaming, briefingActive, sendChat, reviewChat, resetChat } = useSb();
  const [input, setInput] = useState('');
  const [sweeping, setSweeping] = useState(false);
  const [sweepNote, setSweepNote] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  // chat / briefing / streaming now live in the provider, so they persist across
  // node navigation. This page just renders them and drives input.
  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [chat]);

  const ready = isDesktop && agent?.reachable && !!agent.model;

  const send = (text: string) => {
    if (!text.trim() || chatStreaming) return;
    setInput('');
    void sendChat(text);
  };

  const sweepNow = async () => {
    if (!ready || sweeping || chatStreaming) return;
    setSweeping(true);
    setSweepNote('SB-Σ is sweeping every node…');
    const r = await sweep();
    setSweeping(false);
    setSweepNote(
      r.error ? `⚠ ${r.error}`
        : r.created > 0 ? `Raised ${r.created} flag${r.created === 1 ? '' : 's'} → see the Flags screen.`
        : r.ran ? 'Swept — nothing new to flag. You\'re clear.'
        : '⚠ Sweep did not run.',
    );
  };

  return (
    <div className="page">
      <HubFrame>
        <div className="sigma">
          <div className="sigma-head">
            <span className="title">SB-Σ // Synthesizer</span>
            <span className="meta">
              {ready && chat.length > 0 && (
                <button className="btn" style={{ marginRight: 10, padding: '4px 9px', fontSize: 9 }}
                  disabled={chatStreaming} onClick={resetChat}>New chat</button>
              )}
              {!isDesktop ? 'desktop only'
                : agent?.reachable
                  ? <>local · <span className="ok">{agent.model || 'no model'}</span></>
                  : <span className="bad">ollama offline</span>}
            </span>
          </div>

          {!ready ? (
            <AgentSetup isDesktop={isDesktop} reachable={!!agent?.reachable} hasModel={!!agent?.model} pull={modelPull} onRetry={refreshAgent} />
          ) : (
            <>
              <div className="chat" ref={chatRef}>
                {chat.length === 0 ? (
                  <div className="chat-empty">
                    SB-Σ reads every screen — training, pharmacology, substrate — and answers from your live numbers.
                    Nothing leaves this machine.
                    <div className="prompts">
                      {STARTERS.map((s) => <button key={s} className="btn" onClick={() => send(s)}>{s}</button>)}
                    </div>
                  </div>
                ) : chat.map((m, i) => {
                  const isBriefing = briefingActive && i === 0 && m.role === 'assistant';
                  return (
                    <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'sigma'}${isBriefing ? ' briefing' : ''}${chatStreaming && i === chat.length - 1 && m.role === 'assistant' ? ' streaming' : ''}`}>
                      <span className="who">{m.role === 'user' ? 'You' : isBriefing ? 'SB-Σ // Launch briefing' : 'SB-Σ'}</span>{m.content}
                    </div>
                  );
                })}
              </div>

              <div className="composer">
                <textarea
                  value={input}
                  placeholder="Ask SB-Σ, or challenge a decision…"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                />
                <div className="btnrow-inline" style={{ flexDirection: 'column' }}>
                  <button className="btn primary" disabled={chatStreaming || !input.trim()} onClick={() => send(input)}>Send</button>
                  <button className="btn" disabled={chatStreaming || sweeping} onClick={() => reviewChat()}>Review</button>
                  <button className="btn" disabled={chatStreaming || sweeping} onClick={sweepNow} title="SB-Σ audits every node and raises persistent flags">
                    {sweeping ? 'Sweeping…' : 'Sweep'}
                  </button>
                </div>
              </div>
              {sweepNote && <div className="sweep-note">{sweepNote}</div>}
            </>
          )}
        </div>
      </HubFrame>
    </div>
  );
}

function AgentSetup({ isDesktop, reachable, hasModel, pull, onRetry }: {
  isDesktop: boolean; reachable: boolean; hasModel: boolean;
  pull: ModelPullStatus | null; onRetry: () => void;
}) {
  return (
    <div className="agent-setup">
      {!isDesktop ? (
        <>SB-Σ runs inside the desktop app against a <b>local model</b> — launch SB-00 as the standalone program to talk to it.</>
      ) : !reachable ? (
        <>
          <b>SB-Σ needs Ollama running locally.</b> Your data never leaves this machine.<br /><br />
          1. Install Ollama from <b>ollama.com</b>.<br />
          2. The app will automatically download a model for you on first launch.<br />
          3. Make sure Ollama is running, then <button className="btn" onClick={onRetry}>Re-check</button>
        </>
      ) : !hasModel ? (
        pull && pull.status === 'pulling' ? (
          <PullProgress pull={pull} />
        ) : pull?.status === 'error' ? (
          <>
            <b>Model download failed:</b> {pull.error}<br /><br />
            You can pull one manually: <code>ollama pull llama3.2:3b</code>, then{' '}
            <button className="btn" onClick={onRetry}>Re-check</button>
          </>
        ) : (
          <>
            Ollama is running — <b>downloading model automatically…</b><br />
            <button className="btn" style={{ marginTop: '0.75rem' }} onClick={onRetry}>Re-check</button>
          </>
        )
      ) : null}
    </div>
  );
}

function PullProgress({ pull }: { pull: ModelPullStatus }) {
  return (
    <div className="pull-progress">
      <div className="pull-label">
        Downloading <b>{pull.model}</b>
        {pull.pct != null ? ` — ${pull.pct}%` : ''}
      </div>
      {pull.pct != null && (
        <div className="pull-bar-track">
          <div className="pull-bar-fill" style={{ width: `${pull.pct}%` }} />
        </div>
      )}
      <div className="pull-detail">{pull.detail ?? 'connecting…'}</div>
    </div>
  );
}
