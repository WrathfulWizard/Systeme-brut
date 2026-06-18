/**
 * Shared view-model types — the contract between the Electron backend
 * (desktop/db/queries) and the renderer UI (lib/client). Kept deliberately
 * close to the v2 schema tables/views so the IPC layer is a thin pass-through.
 */

export type Severity = 'info' | 'flag';
export type NodeGroup = 'training' | 'pharmacology' | 'nutrition';

export interface Insight {
  id: number;
  at: string;
  severity: Severity;
  body: string;
  nodes: NodeGroup[];
}

export interface SetRow { date: string; exercise: string; set: string; weight: string; reps: string; }
export interface PrRow { exercise: string; prVolume: number; lastBeat: string; status: string; }
export interface Bar { lift: string; value: number; }
export interface CardioPoint { date: string; distance: number; }
export interface RunRow { date: string; distance: string; pace: string; source: string; }
export interface RegimenRow { compound: string; dose: string; route: string; }
export interface AdminRow { date: string; compound: string; dose: string; route: string; }
export interface TitrationRow { date: string; compound: string; change: string; trigger: string; }
export interface LabResult { marker: string; value: string; range: string; flagged: boolean; }
export interface SerumPoint { day: string; mg: number; }
export interface TotalRow { nutrient: string; today: string; target: string; delta: string; }
export interface CaloriePoint { day: string; kcal: number; }
export interface VitaminRow { nutrient: string; amount: string; rda: string; flagged: boolean; }
export interface MineralRow { mineral: string; amount: string; target: string; flagged: boolean; }

/** Everything a screen needs, fetched in one IPC round-trip. */
export interface Snapshot {
  insights: Insight[];
  recentSets: SetRow[];
  prLog: PrRow[];
  tonnage: Bar[];
  cardioGoal: { metric: string; target: number; longest: number; unit: string };
  cardioProgression: CardioPoint[];
  recentRuns: RunRow[];
  regimen: RegimenRow[];
  administrations: AdminRow[];
  titration: TitrationRow[];
  labResults: LabResult[];
  serum7d: SerumPoint[];
  dailyTotals: TotalRow[];
  calories7d: CaloriePoint[];
  vitamins: VitaminRow[];
  minerals: MineralRow[];
  session: { id: string; clock: string };
  syncMeta: SyncMeta;
  /** lookup lists for the in-app log forms */
  catalog: { exercises: string[]; compounds: string[] };
}

/* ---- manual logging inputs (write path) --------------------------------- */

export type SetKind = 'straight' | 'rp1' | 'rp_burst';

export interface LiftInput { date: string; exercise: string; setKind: SetKind; weightKg: number; reps: number; }
export interface AdminInput { compound: string; doseMg: number; route: string; administeredAt: string; }
export interface TitrationInput { compound: string; before?: number; after: number; notes?: string; changedAt: string; }
export interface LabResultInput { marker: string; value: number; unit?: string; low?: number; high?: number; }
export interface LabPanelInput { drawnAt: string; labName?: string; results: LabResultInput[]; }

/* ---- connections / sync (the desktop-only surface) ---------------------- */

export type SourceId = 'strava' | 'cronometer' | 'apple_health';
export type SourceStatus = 'connected' | 'disconnected' | 'error';

export interface ConnectionState {
  source: SourceId;
  status: SourceStatus;
  detail?: string;        // account label, last error, etc.
  lastSyncAt?: string;    // ISO
}

export interface SyncMeta {
  /** receiver endpoint the Apple Health bridge posts to, e.g. http://localhost:8787/ingest/health */
  healthEndpoint?: string;
  connections: ConnectionState[];
}

/** The API exposed on window.sb by the Electron preload bridge. */
export interface SbBridge {
  isDesktop: true;
  getSnapshot(): Promise<Snapshot>;
  getConnections(): Promise<SyncMeta>;
  connectStrava(): Promise<SyncMeta>;
  connectCronometer(username: string, password: string): Promise<ConnectionState>;
  disconnect(source: SourceId): Promise<SyncMeta>;
  syncNow(source?: SourceId): Promise<SyncMeta>;
  onSyncUpdate(cb: (meta: SyncMeta) => void): () => void;
  /* manual logging — each returns a fresh snapshot so the UI updates live */
  addSet(input: LiftInput): Promise<Snapshot>;
  addAdministration(input: AdminInput): Promise<Snapshot>;
  addTitration(input: TitrationInput): Promise<Snapshot>;
  addLabPanel(input: LabPanelInput): Promise<Snapshot>;
}
