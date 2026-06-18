'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  Snapshot, SyncMeta, SourceId, ConnectionState, SbBridge,
  LiftInput, AdminInput, TitrationInput, LabPanelInput, ProtocolInput, AgentStatus,
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
  disconnect: (s: SourceId) => Promise<void>;
  syncNow: (s?: SourceId) => Promise<void>;
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
  saveStravaApp: (clientId: string, clientSecret: string) => Promise<void>;
  addProtocol: (input: ProtocolInput) => Promise<void>;
  titrateProtocol: (id: number, newDoseMg: number, note?: string) => Promise<void>;
  endProtocol: (id: number) => Promise<void>;
  deleteProtocol: (id: number) => Promise<void>;
  resolveInsight: (id: number) => Promise<void>;
  agent: AgentStatus | null;
  refreshAgent: () => Promise<void>;
  setAgentModel: (model: string) => Promise<void>;
}

const SbContext = createContext<Ctx | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(seedSnapshot);
  const [sync, setSync] = useState<SyncMeta>(seedSnapshot.syncMeta);
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const isDesktop = typeof window !== 'undefined' && !!window.sb;

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
    const off = window.sb.onSyncUpdate((m) => { setSync(m); void refresh(); });
    return off;
  }, [refresh, refreshAgent]);

  const value = useMemo<Ctx>(() => ({
    snapshot, sync, isDesktop, refresh,
    connectStrava: async () => { if (window.sb) setSync(await window.sb.connectStrava()); await refresh(); },
    connectCronometer: async (u, p) => {
      if (!window.sb) return;
      const c = await window.sb.connectCronometer(u, p);
      await refresh();
      return c;
    },
    disconnect: async (s) => { if (window.sb) setSync(await window.sb.disconnect(s)); await refresh(); },
    syncNow: async (s) => { if (window.sb) setSync(await window.sb.syncNow(s)); await refresh(); },
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
    saveStravaApp: async (clientId, clientSecret) => { if (window.sb) setSync(await window.sb.saveStravaApp(clientId, clientSecret)); },
    addProtocol: async (input) => { if (window.sb) { const s = await window.sb.addProtocol(input); setSnapshot(s); setSync(s.syncMeta); } },
    titrateProtocol: async (id, mg, note) => { if (window.sb) { const s = await window.sb.titrateProtocol(id, mg, note); setSnapshot(s); setSync(s.syncMeta); } },
    endProtocol: async (id) => { if (window.sb) { const s = await window.sb.endProtocol(id); setSnapshot(s); setSync(s.syncMeta); } },
    deleteProtocol: async (id) => { if (window.sb) { const s = await window.sb.deleteProtocol(id); setSnapshot(s); setSync(s.syncMeta); } },
    resolveInsight: async (id) => { if (window.sb) { const s = await window.sb.resolveInsight(id); setSnapshot(s); setSync(s.syncMeta); } },
    agent, refreshAgent,
    setAgentModel: async (model) => { if (window.sb) setAgent(await window.sb.setAgentModel(model)); },
  }), [snapshot, sync, isDesktop, refresh, agent, refreshAgent]);

  return <SbContext.Provider value={value}>{children}</SbContext.Provider>;
}

export function useSb(): Ctx {
  const ctx = useContext(SbContext);
  if (!ctx) throw new Error('useSb must be used within <Providers>');
  return ctx;
}

/** Convenience: just the data snapshot (always defined — seeded on first paint). */
export const useSnapshot = () => useSb().snapshot;
