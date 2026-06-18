'use client';

import { useEffect, useRef, useState } from 'react';
import HubFrame from '@/components/HubFrame';
import { useSb } from './providers';
import type { ChatMessage } from '@/lib/types';

const STARTERS = [
  'Review my current state.',
  'Is my current protocol justified by my labs?',
  'Where am I stalling?',
  'What should I log next?',
];

export default function Sigma() {
  const { agent, refreshAgent, isDesktop, sweep } = useSb();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [sweepNote, setSweepNote] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.sb) return;
    const offT = window.sb.onAgentToken((chunk) => {
      setMessages((m) => {
        const last = m[m.length - 1];
        if (last?.role === 'assistant') return [...m.slice(0, -1), { ...last, content: last.content + chunk }];
        return [...m, { role: 'assistant', content: chunk }];
      });
    });
    const offD = window.sb.onAgentDone(() => setStreaming(false));
    const offE = window.sb.onAgentError((msg) => {
      setStreaming(false);
      setMessages((m) => {
        const last = m[m.length - 1];
        const note = `⚠ ${msg}`;
        if (last?.role === 'assistant' && last.content === '') return [...m.slice(0, -1), { role: 'assistant', content: note }];
        return [...m, { role: 'assistant', content: note }];
      });
    });
    return () => { offT(); offD(); offE(); };
  }, []);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages]);

  const ready = isDesktop && agent?.reachable && !!agent.model;

  const send = async (text: string) => {
    if (!window.sb || !text.trim() || streaming || !ready) return;
    const history: ChatMessage[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput(''); setStreaming(true);
    await window.sb.agentChat(history);
  };

  const review = async () => {
    if (!window.sb || streaming || !ready) return;
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);
    setStreaming(true);
    await window.sb.agentReview();
  };

  const sweepNow = async () => {
    if (!ready || sweeping || streaming) return;
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
              {!isDesktop ? 'desktop only'
                : agent?.reachable
                  ? <>local · <span className="ok">{agent.model || 'no model'}</span></>
                  : <span className="bad">ollama offline</span>}
            </span>
          </div>

          {!ready ? (
            <AgentSetup isDesktop={isDesktop} reachable={!!agent?.reachable} hasModel={!!agent?.model} onRetry={refreshAgent} />
          ) : (
            <>
              <div className="chat" ref={chatRef}>
                {messages.length === 0 ? (
                  <div className="chat-empty">
                    SB-Σ reads every screen — training, pharmacology, substrate — and answers from your live numbers.
                    Nothing leaves this machine.
                    <div className="prompts">
                      {STARTERS.map((s) => <button key={s} className="btn" onClick={() => send(s)}>{s}</button>)}
                    </div>
                  </div>
                ) : messages.map((m, i) => (
                  <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'sigma'}${streaming && i === messages.length - 1 && m.role === 'assistant' ? ' streaming' : ''}`}>
                    <span className="who">{m.role === 'user' ? 'You' : 'SB-Σ'}</span>{m.content}
                  </div>
                ))}
              </div>

              <div className="composer">
                <textarea
                  value={input}
                  placeholder="Ask SB-Σ, or challenge a decision…"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                />
                <div className="btnrow-inline" style={{ flexDirection: 'column' }}>
                  <button className="btn primary" disabled={streaming || !input.trim()} onClick={() => send(input)}>Send</button>
                  <button className="btn" disabled={streaming || sweeping} onClick={review}>Review</button>
                  <button className="btn" disabled={streaming || sweeping} onClick={sweepNow} title="SB-Σ audits every node and raises persistent flags">
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

function AgentSetup({ isDesktop, reachable, hasModel, onRetry }: { isDesktop: boolean; reachable: boolean; hasModel: boolean; onRetry: () => void }) {
  return (
    <div className="agent-setup">
      {!isDesktop ? (
        <>SB-Σ runs inside the desktop app against a <b>local model</b> — launch SB-00 as the standalone program to talk to it.</>
      ) : !reachable ? (
        <>
          <b>SB-Σ needs Ollama running locally.</b> Your data never leaves this machine.<br /><br />
          1. Install Ollama from <b>ollama.com</b>.<br />
          2. Pull a model: <code>ollama pull llama3.1</code> (or <code>qwen2.5</code>, <code>mistral</code>).<br />
          3. Make sure Ollama is running, then <button className="btn" onClick={onRetry}>Re-check</button>
        </>
      ) : !hasModel ? (
        <>
          Ollama is running, but <b>no model is installed</b>. Pull one: <code>ollama pull llama3.1</code>, then{' '}
          <button className="btn" onClick={onRetry}>Re-check</button>. Pick the model on the <b>Connections</b> screen.
        </>
      ) : null}
    </div>
  );
}
