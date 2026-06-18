/**
 * Shared view-model types — the contract between the Electron backend
 * (desktop/db/queries) and the renderer UI (lib/client). Kept deliberately
 * close to the v2 schema tables/views so the IPC layer is a thin pass-through.
 */

export type Severity = 'info' | 'flag';
export type NodeGroup = 'training' | 'pharmacology' | 'nutrition';
export type Sport = 'run' | 'ride' | 'swim';

export interface Insight {
  id: number;
  at: string;
  severity: Severity;
  body: string;
  nodes: NodeGroup[];
}

// rows carry their DB id + raw values so the UI can edit/delete them
export interface SetRow {
  id: number; date: string; exercise: string; set: string; weight: string; reps: string;
  iso: string; setKind: SetKind; weightKg: number; repsN: number;
}
export interface PrRow { exercise: string; prVolume: number; lastBeat: string; status: string; }
export interface Bar { lift: string; value: number; }
export interface CardioPoint { date: string; distance: number; }
export interface RunRow { date: string; distance: string; pace: string; source: string; sport: Sport; duration?: string; }
/** A continuous compound protocol — current daily dose, titrated over time. */
export interface ProtocolRow { id: number; compound: string; dose: string; route: string; doseMg: number; route_raw: string; since: string; }
export interface AdminRow {
  id: number; date: string; compound: string; dose: string; route: string;
  iso: string; doseMg: number; routeRaw: string;
}
export interface TitrationRow { id: number; date: string; compound: string; change: string; trigger: string; }
export interface LabResult { marker: string; value: string; range: string; flagged: boolean; at?: string; }
export interface SerumPoint { day: string; mg: number; }
/** A running shoe / bike with accumulated mileage (Strava gear or manual). */
export interface GearRow { id: number; name: string; kind: 'shoe' | 'bike'; km: number; retired: boolean; source: string; }

/** Per-compound estimated serum, for the Serum Dynamics visual. */
export type SerumCharacter = 'steady' | 'confident' | 'oscillating' | 'saturated';
export interface SerumCompound {
  key: string;
  label: string;          // terse readout label e.g. "TEST E"
  klass: string;          // family e.g. "Testosterone"
  color: string;          // hex — stream colour
  character: SerumCharacter;
  halfLifeDays: number;
  current: number;        // estimated mg in system now
  peak: number;           // max over the window
  series: SerumPoint[];   // estimated serum over the window (up to 56d)
  steadyState: boolean;   // has the protocol run ≥ ~4.3 half-lives (plateau)?
  discontinued: boolean;  // protocol ended but compound still clearing
  form: 'injectable' | 'oral';
}
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
  cardioBySport: { sport: Sport; count: number; distanceKm: number }[];
  /** running shoes / bikes + accumulated mileage */
  gear: GearRow[];
  protocols: ProtocolRow[];
  administrations: AdminRow[];
  titration: TitrationRow[];
  labResults: LabResult[];
  serum7d: SerumPoint[];
  /** estimated serum per active compound (half-life model) — the visual */
  serumByCompound: SerumCompound[];
  dailyTotals: TotalRow[];
  calories7d: CaloriePoint[];
  vitamins: VitaminRow[];
  minerals: MineralRow[];
  /** bodyweight goal + latest reading + trend (Substrate node + goal corner) */
  weightGoal: { current?: number; target: number; unit: string; trend: { day: string; kg: number }[] };
  session: { id: string; clock: string };
  syncMeta: SyncMeta;
  /** lookup lists for the in-app log forms */
  catalog: { exercises: string[]; compounds: string[] };
  /** id of the latest lab panel (for delete) */
  labPanelId?: number;
}

/* ---- manual logging inputs (write path) --------------------------------- */

export type SetKind = 'straight' | 'rp1' | 'rp_burst';

export interface LiftInput { date: string; exercise: string; setKind: SetKind; weightKg: number; reps: number; }
export interface AdminInput { compound: string; doseMg: number; route: string; administeredAt: string; }
export interface TitrationInput { compound: string; before?: number; after: number; notes?: string; changedAt: string; }
export interface LabResultInput { marker: string; value: number; unit?: string; low?: number; high?: number; }
export interface LabPanelInput { drawnAt: string; labName?: string; results: LabResultInput[]; }
export interface ProtocolInput { compound: string; doseMg: number; route: string; note?: string; startedAt?: string; }

/* ---- SB-Σ agent --------------------------------------------------------- */
export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string; }
export interface AgentStatus {
  provider: 'ollama';
  url: string;
  reachable: boolean;
  models: string[];   // installed Ollama models
  model: string;      // selected
  error?: string;
}

/** Live status of an automatic model pull (emitted while downloading). */
export interface ModelPullStatus {
  model: string;
  status: 'pulling' | 'done' | 'error';
  pct?: number;       // 0–100 while downloading
  detail?: string;    // Ollama's status string e.g. "pulling manifest"
  error?: string;
}

/** Result of an SB-Σ sweep: how many flags it raised into the Flags feed. */
export interface SweepResult {
  ran: boolean;        // did the model actually run (false on offline / no model)
  created: number;     // new flags written (after de-dup)
  considered: number;  // flags the model proposed this pass
  error?: string;
}

/* ---- connections / sync (the desktop-only surface) ---------------------- */

export type SourceId = 'strava' | 'cronometer' | 'apple_health';
export type SourceStatus = 'connected' | 'disconnected' | 'error';

export interface ConnectionState {
  source: SourceId;
  status: SourceStatus;
  detail?: string;        // account label, last error, etc.
  lastSyncAt?: string;    // ISO
  configured?: boolean;   // strava: are Client ID/Secret saved?
}

export interface SyncMeta {
  /** receiver endpoint the Apple Health bridge posts to, e.g. http://localhost:8787/ingest/health */
  healthEndpoint?: string;
  connections: ConnectionState[];
  agent?: AgentStatus;
}

/** The API exposed on window.sb by the Electron preload bridge. */
export interface SbBridge {
  isDesktop: true;
  getSnapshot(): Promise<Snapshot>;
  getConnections(): Promise<SyncMeta>;
  connectStrava(): Promise<SyncMeta>;
  connectCronometer(username: string, password: string): Promise<ConnectionState>;
  /** Import a Cronometer CSV the user exported themselves (ToS-clean, reliable). */
  importCronometerCsv(csv: string): Promise<{ ok: boolean; days: number; error?: string }>;
  disconnect(source: SourceId): Promise<SyncMeta>;
  syncNow(source?: SourceId): Promise<SyncMeta>;
  onSyncUpdate(cb: (meta: SyncMeta) => void): () => void;
  /* manual logging — each returns a fresh snapshot so the UI updates live */
  addSet(input: LiftInput): Promise<Snapshot>;
  updateSet(id: number, input: LiftInput): Promise<Snapshot>;
  deleteSet(id: number): Promise<Snapshot>;
  addAdministration(input: AdminInput): Promise<Snapshot>;
  updateAdministration(id: number, input: AdminInput): Promise<Snapshot>;
  deleteAdministration(id: number): Promise<Snapshot>;
  addTitration(input: TitrationInput): Promise<Snapshot>;
  deleteTitration(id: number): Promise<Snapshot>;
  addLabPanel(input: LabPanelInput): Promise<Snapshot>;
  deleteLabPanel(id: number): Promise<Snapshot>;
  /* pharmacology protocol */
  addProtocol(input: ProtocolInput): Promise<Snapshot>;
  titrateProtocol(id: number, newDoseMg: number, note?: string): Promise<Snapshot>;
  endProtocol(id: number): Promise<Snapshot>;
  deleteProtocol(id: number): Promise<Snapshot>;
  /* flags (SB-Σ) */
  resolveInsight(id: number): Promise<Snapshot>;
  /* strava app credentials (so connecting needs no env vars) */
  saveStravaApp(clientId: string, clientSecret: string): Promise<SyncMeta>;
  /* SB-Σ local agent (Ollama) */
  agentStatus(): Promise<AgentStatus>;
  setAgentModel(model: string): Promise<AgentStatus>;
  agentChat(messages: ChatMessage[]): Promise<void>;          // streams via events
  agentReview(): Promise<void>;                               // proactive once-over, streams
  agentSweep(): Promise<SweepResult>;                         // raises persistent flags
  onAgentToken(cb: (chunk: string) => void): () => void;
  onAgentDone(cb: (full: string) => void): () => void;
  onAgentError(cb: (message: string) => void): () => void;
  /** Fires during / after an automatic background model pull on first launch. */
  onModelPull(cb: (s: ModelPullStatus) => void): () => void;
}
