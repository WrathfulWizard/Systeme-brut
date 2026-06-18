'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  Snapshot, SyncMeta, SourceId, ConnectionState, SbBridge,
  LiftInput, AdminInput, TitrationInput, LabPanelInput,
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
  addAdministration: (input: AdminInput) => Promise<void>;
  addTitration: (input: TitrationInput) => Promise<void>;
  addLabPanel: (input: LabPanelInput) => Promise<void>;
}

const SbContext = createContext<Ctx | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(seedSnapshot);
  const [sync, setSync] = useState<SyncMeta>(seedSnapshot.syncMeta);
  const isDesktop = typeof window !== 'undefined' && !!window.sb;

  const refresh = useCallback(async () => {
    if (!window.sb) return;
    const snap = await window.sb.getSnapshot();
    setSnapshot(snap);
    setSync(snap.syncMeta);
  }, []);

  useEffect(() => {
    if (!window.sb) return;
    void refresh();
    const off = window.sb.onSyncUpdate((m) => { setSync(m); void refresh(); });
    return off;
  }, [refresh]);

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
    addAdministration: async (input) => { if (window.sb) { const s = await window.sb.addAdministration(input); setSnapshot(s); setSync(s.syncMeta); } },
    addTitration: async (input) => { if (window.sb) { const s = await window.sb.addTitration(input); setSnapshot(s); setSync(s.syncMeta); } },
    addLabPanel: async (input) => { if (window.sb) { const s = await window.sb.addLabPanel(input); setSnapshot(s); setSync(s.syncMeta); } },
  }), [snapshot, sync, isDesktop, refresh]);

  return <SbContext.Provider value={value}>{children}</SbContext.Provider>;
}

export function useSb(): Ctx {
  const ctx = useContext(SbContext);
  if (!ctx) throw new Error('useSb must be used within <Providers>');
  return ctx;
}

/** Convenience: just the data snapshot (always defined — seeded on first paint). */
export const useSnapshot = () => useSb().snapshot;
