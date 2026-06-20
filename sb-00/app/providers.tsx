'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Snapshot, SyncMeta, SourceId, ConnectionState, SbBridge,
  LiftInput, AdminInput, TitrationInput, LabPanelInput, ProtocolInput, AgentStatus, SweepResult,
  ModelPullStatus, BodyMetricInput, ChatMessage,
} from '@/lib/types';
import { seedSnapshot } from '@/lib/seed-data';

declare global {
  interface Window { sb?: SbBridge }
}

interface Ctx {
  snapshot: Snapshot;
  sync: SyncMeta;
  isDesktop: boolean;
  refresh: () => Promise<void>;
  connectStrava: () => Promise<void>;
  connectCronometer: (u: string, p: string) => Promise<ConnectionState | void>;
  connectCronometerBrowser: (u?: string, p?: string) => Promise<ConnectionState | void>;
  importCronometerCsv: (csv: string) => Promise<{ ok: boolean; days: number; error?: string }>;
  disconnect: (s: SourceId) => Promise<void>;
  syncNow: (s?: SourceId) => Promise<void>;
  startHealthTunnel: () => Promise<void>;
  stopHealthTunnel: () => Promise<void>;
  addSet: (input: LiftInput) => Promise<void>;
  updateSet: (id: number, input: LiftInput) => Promise<void>;
  deleteSet: (id: number) => Promise<void>;
  addAdministration: (input: AdminInput) => Promise<void>;
  updateAdministration: (id: number, input: AdminInput) => Promise<void>;
  deleteAdministration: (id: number) => Promise<void>;
  addTitration: (input: TitrationInput) => Promise<void>;
  deleteTitration: (id: number) => Promise<void>;
  addLabPanel: (input: LabPanelInput) => Promise<void>;
  deleteLabPanel: (id: number) => Promise<void>;
  addBodyMetric: (input: BodyMetricInput) => Promise<void>;
  deleteBodyMetric: (id: number) => Promise<void>;
  setWeightGoal: (targetKg: number) => Promise<void>;
  saveStravaApp: (clientId: string, clientSecret: string) => Promise<void>;
  addProtocol: (input: ProtocolInput) => Promise<void>;
  titrateProtocol: (id: number, newDoseMg: number, note?: string) => Promise<void>;
  endProtocol: (id: number) => Promise<void>;
  deleteProtocol: (id: number) => Promise<void>;
  resolveInsight: (id: number) => Promise<void>;
  agent: AgentStatus | null;
  refreshAgent: () => Promise<void>;
  setAgentModel: (model: string) => Promise<void>;
  sweep: () => Promise<SweepResult>;
  modelPull: ModelPullStatus | null;
  /* SB-Σ conversation — held here (not in the page) so it survives navigation */
  chat: ChatMessage[];
  chatStreaming: boolean;
  briefingActive: boolean;      // the first message is the launch briefing
  sendChat: (text: string) => Promise<void>;
  reviewChat: () => Promise<void>;
  resetChat: () => void;
}

const SbContext = createContext<Ctx | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(seedSnapshot);
  const [sync, setSync] = useState<SyncMeta>(seedSnapshot.syncMeta);
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [modelPull, setModelPull] = useState<ModelPullStatus | null>(null);
  const isDesktop = typeof window !== 'undefined' && !!window.sb;

  // SB-Σ conversation lives at the app level so navigating between nodes never
  // wipes it. chatRef mirrors state so async IPC callbacks read the live value.
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [briefingActive, setBriefingActive] = useState(false);
  const chatRef = useRef<ChatMessage[]>([]);
  const writeChat = useCallback((next: ChatMessage[]) => { chatRef.current = next; setChat(next); }, []);

  const refresh = useCallback(async () => {
    if (!window.sb) return;
    const snap = await window.sb.getSnapshot();
    setSnapshot(snap);
    setSync(snap.syncMeta);
  }, []);

  const refreshAgent = useCallback(async () => {
    if (!window.sb) return;
    try { setAgent(await window.sb.agentStatus()); } catch { /* ollama offline */ }
  }, []);

  useEffect(() => {
    if (!window.sb) return;
    void refresh();
    void refreshAgent();
    const offSync = window.sb.onSyncUpdate((m) => { setSync(m); void refresh(); });
    const offPull = window.sb.onModelPull((s) => {
      setModelPull(s);
      // Once download finishes, refresh agent status so the model shows up.
      if (s.status === 'done') void refreshAgent();
    });
    return () => { offSync(); offPull(); };
  }, [refresh, refreshAgent]);

  // SB-Σ streaming + the launch briefing — wired once at the app level.
  useEffect(() => {
    if (!window.sb) return;
    const offT = window.sb.onAgentToken((chunk) => {
      const m = chatRef.current;
      const last = m[m.length - 1];
      writeChat(last?.role === 'assistant'
        ? [...m.slice(0, -1), { ...last, content: last.content + chunk }]
        : [...m, { role: 'assistant', content: chunk }]);
    });
    const offD = window.sb.onAgentDone(() => setChatStreaming(false));
    const offE = window.sb.onAgentError((msg) => {
      setChatStreaming(false);
      const m = chatRef.current;
      const last = m[m.length - 1];
      const note = `⚠ ${msg}`;
      writeChat(last?.role === 'assistant' && last.content === ''
        ? [...m.slice(0, -1), { role: 'assistant', content: note }]
        : [...m, { role: 'assistant', content: note }]);
    });

    // Launch briefing: subscribe FIRST, then fetch, so a review that resolves
    // during setup is never missed. Seed only into an empty conversation.
    let seeded = false;
    const seed = (r: { status: string; text?: string }) => {
      if (seeded || r.status !== 'ready' || !r.text || chatRef.current.length) return;
      seeded = true;
      setBriefingActive(true);
      writeChat([{ role: 'assistant', content: r.text }]);
      void refreshAgent();   // review-ready ⇒ agent is reachable; flip the UI gate
    };
    const offReview = window.sb.onReviewReady(seed);
    window.sb.getStartupReview().then(seed).catch(() => {});

    return () => { offT(); offD(); offE(); offReview(); };
  }, [writeChat, refreshAgent]);

  const value = useMemo<Ctx>(() => ({
    snapshot, sync, isDesktop, refresh,
    connectStrava: async () => { if (window.sb) setSync(await window.sb.connectStrava()); await refresh(); },
    connectCronometer: async (u, p) => {
      if (!window.sb) return;
      const c = await window.sb.connectCronometer(u, p);
      await refresh();
      return c;
    },
    connectCronometerBrowser: async (u, p) => {
      if (!window.sb) return;
      const c = await window.sb.connectCronometerBrowser(u, p);
      await refresh();
      return c;
    },
    importCronometerCsv: async (csv: string) => {
      if (!window.sb) return { ok: false, days: 0, error: 'desktop only' };
      const r = await window.sb.importCronometerCsv(csv);
      await refresh();
      return r;
    },
    disconnect: async (s) => { if (window.sb) setSync(await window.sb.disconnect(s)); await refresh(); },
    syncNow: async (s) => { if (window.sb) setSync(await window.sb.syncNow(s)); await refresh(); },
    startHealthTunnel: async () => { if (window.sb) setSync(await window.sb.startHealthTunnel()); },
    stopHealthTunnel: async () => { if (window.sb) setSync(await window.sb.stopHealthTunnel()); },
    addSet: async (input) => { if (window.sb) { const s = await window.sb.addSet(input); setSnapshot(s); setSync(s.syncMeta); } },
    updateSet: async (id, input) => { if (window.sb) { const s = await window.sb.updateSet(id, input); setSnapshot(s); setSync(s.syncMeta); } },
    deleteSet: async (id) => { if (window.sb) { const s = await window.sb.deleteSet(id); setSnapshot(s); setSync(s.syncMeta); } },
    addAdministration: async (input) => { if (window.sb) { const s = await window.sb.addAdministration(input); setSnapshot(s); setSync(s.syncMeta); } },
    updateAdministration: async (id, input) => { if (window.sb) { const s = await window.sb.updateAdministration(id, input); setSnapshot(s); setSync(s.syncMeta); } },
    deleteAdministration: async (id) => { if (window.sb) { const s = await window.sb.deleteAdministration(id); setSnapshot(s); setSync(s.syncMeta); } },
    addTitration: async (input) => { if (window.sb) { const s = await window.sb.addTitration(input); setSnapshot(s); setSync(s.syncMeta); } },
    deleteTitration: async (id) => { if (window.sb) { const s = await window.sb.deleteTitration(id); setSnapshot(s); setSync(s.syncMeta); } },
    addLabPanel: async (input) => { if (window.sb) { const s = await window.sb.addLabPanel(input); setSnapshot(s); setSync(s.syncMeta); } },
    deleteLabPanel: async (id) => { if (window.sb) { const s = await window.sb.deleteLabPanel(id); setSnapshot(s); setSync(s.syncMeta); } },
    addBodyMetric: async (input) => { if (window.sb) { const s = await window.sb.addBodyMetric(input); setSnapshot(s); setSync(s.syncMeta); } },
    deleteBodyMetric: async (id) => { if (window.sb) { const s = await window.sb.deleteBodyMetric(id); setSnapshot(s); setSync(s.syncMeta); } },
    setWeightGoal: async (targetKg) => { if (window.sb) { const s = await window.sb.setWeightGoal(targetKg); setSnapshot(s); setSync(s.syncMeta); } },
    saveStravaApp: async (clientId, clientSecret) => { if (window.sb) setSync(await window.sb.saveStravaApp(clientId, clientSecret)); },
    addProtocol: async (input) => { if (window.sb) { const s = await window.sb.addProtocol(input); setSnapshot(s); setSync(s.syncMeta); } },
    titrateProtocol: async (id, mg, note) => { if (window.sb) { const s = await window.sb.titrateProtocol(id, mg, note); setSnapshot(s); setSync(s.syncMeta); } },
    endProtocol: async (id) => { if (window.sb) { const s = await window.sb.endProtocol(id); setSnapshot(s); setSync(s.syncMeta); } },
    deleteProtocol: async (id) => { if (window.sb) { const s = await window.sb.deleteProtocol(id); setSnapshot(s); setSync(s.syncMeta); } },
    resolveInsight: async (id) => { if (window.sb) { const s = await window.sb.resolveInsight(id); setSnapshot(s); setSync(s.syncMeta); } },
    agent, refreshAgent, modelPull,
    setAgentModel: async (model) => { if (window.sb) setAgent(await window.sb.setAgentModel(model)); },
    sweep: async () => {
      if (!window.sb) return { ran: false, created: 0, considered: 0, error: 'desktop only' };
      const r = await window.sb.agentSweep();
      await refresh();   // new flags land in the feed
      return r;
    },
    chat, chatStreaming, briefingActive,
    sendChat: async (text) => {
      const t = text.trim();
      if (!window.sb || !t || chatStreaming) return;
      const history: ChatMessage[] = [...chatRef.current, { role: 'user', content: t }];
      writeChat([...history, { role: 'assistant', content: '' }]);
      setChatStreaming(true);
      await window.sb.agentChat(history);
    },
    reviewChat: async () => {
      if (!window.sb || chatStreaming) return;
      writeChat([...chatRef.current, { role: 'assistant', content: '' }]);
      setChatStreaming(true);
      await window.sb.agentReview();
    },
    resetChat: () => { setBriefingActive(false); writeChat([]); },
  }), [snapshot, sync, isDesktop, refresh, agent, refreshAgent, modelPull, chat, chatStreaming, briefingActive, writeChat]);

  return <SbContext.Provider value={value}>{children}</SbContext.Provider>;
}

export function useSb(): Ctx {
  const ctx = useContext(SbContext);
  if (!ctx) throw new Error('useSb must be used within <Providers>');
  return ctx;
}

/** Convenience: just the data snapshot (always defined — seeded on first paint). */
export const useSnapshot = () => useSb().snapshot;
