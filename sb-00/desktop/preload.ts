import { contextBridge, ipcRenderer } from 'electron';
import type {
  SbBridge, SyncMeta, SourceId, LiftInput, AdminInput, TitrationInput, LabPanelInput,
  ProtocolInput, ChatMessage, ModelPullStatus, BodyMetricInput,
} from '../lib/types';

/**
 * The only surface the renderer can touch. Everything goes through typed,
 * promise-based IPC — the renderer never sees SQLite, tokens, or the network.
 */
const bridge: SbBridge = {
  isDesktop: true,
  getSnapshot: () => ipcRenderer.invoke('sb:getSnapshot'),
  getConnections: () => ipcRenderer.invoke('sb:getConnections'),
  connectStrava: () => ipcRenderer.invoke('sb:connectStrava'),
  connectCronometer: (username, password) => ipcRenderer.invoke('sb:connectCronometer', username, password),
  importCronometerCsv: (csv: string) => ipcRenderer.invoke('sb:importCronometerCsv', csv),
  disconnect: (source: SourceId) => ipcRenderer.invoke('sb:disconnect', source),
  syncNow: (source?: SourceId) => ipcRenderer.invoke('sb:syncNow', source),
  onSyncUpdate: (cb: (m: SyncMeta) => void) => {
    const listener = (_e: unknown, m: SyncMeta) => cb(m);
    ipcRenderer.on('sb:syncUpdate', listener);
    return () => ipcRenderer.removeListener('sb:syncUpdate', listener);
  },
  addSet: (input: LiftInput) => ipcRenderer.invoke('sb:addSet', input),
  updateSet: (id: number, input: LiftInput) => ipcRenderer.invoke('sb:updateSet', id, input),
  deleteSet: (id: number) => ipcRenderer.invoke('sb:deleteSet', id),
  addAdministration: (input: AdminInput) => ipcRenderer.invoke('sb:addAdministration', input),
  updateAdministration: (id: number, input: AdminInput) => ipcRenderer.invoke('sb:updateAdministration', id, input),
  deleteAdministration: (id: number) => ipcRenderer.invoke('sb:deleteAdministration', id),
  addTitration: (input: TitrationInput) => ipcRenderer.invoke('sb:addTitration', input),
  deleteTitration: (id: number) => ipcRenderer.invoke('sb:deleteTitration', id),
  addLabPanel: (input: LabPanelInput) => ipcRenderer.invoke('sb:addLabPanel', input),
  deleteLabPanel: (id: number) => ipcRenderer.invoke('sb:deleteLabPanel', id),
  addBodyMetric: (input) => ipcRenderer.invoke('sb:addBodyMetric', input),
  deleteBodyMetric: (id: number) => ipcRenderer.invoke('sb:deleteBodyMetric', id),
  saveStravaApp: (clientId: string, clientSecret: string) => ipcRenderer.invoke('sb:saveStravaApp', clientId, clientSecret),
  addProtocol: (input: ProtocolInput) => ipcRenderer.invoke('sb:addProtocol', input),
  titrateProtocol: (id: number, newDoseMg: number, note?: string) => ipcRenderer.invoke('sb:titrateProtocol', id, newDoseMg, note),
  endProtocol: (id: number) => ipcRenderer.invoke('sb:endProtocol', id),
  deleteProtocol: (id: number) => ipcRenderer.invoke('sb:deleteProtocol', id),
  resolveInsight: (id: number) => ipcRenderer.invoke('sb:resolveInsight', id),
  agentStatus: () => ipcRenderer.invoke('sb:agentStatus'),
  setAgentModel: (model: string) => ipcRenderer.invoke('sb:setAgentModel', model),
  agentChat: (messages: ChatMessage[]) => ipcRenderer.invoke('sb:agentChat', messages),
  agentReview: () => ipcRenderer.invoke('sb:agentReview'),
  agentSweep: () => ipcRenderer.invoke('sb:agentSweep'),
  onAgentToken: (cb: (chunk: string) => void) => {
    const l = (_e: unknown, chunk: string) => cb(chunk);
    ipcRenderer.on('sb:agentToken', l);
    return () => ipcRenderer.removeListener('sb:agentToken', l);
  },
  onAgentDone: (cb: (full: string) => void) => {
    const l = (_e: unknown, full: string) => cb(full);
    ipcRenderer.on('sb:agentDone', l);
    return () => ipcRenderer.removeListener('sb:agentDone', l);
  },
  onAgentError: (cb: (message: string) => void) => {
    const l = (_e: unknown, m: string) => cb(m);
    ipcRenderer.on('sb:agentError', l);
    return () => ipcRenderer.removeListener('sb:agentError', l);
  },
  onModelPull: (cb: (s: ModelPullStatus) => void) => {
    const l = (_e: unknown, s: ModelPullStatus) => cb(s);
    ipcRenderer.on('sb:modelPull', l);
    return () => ipcRenderer.removeListener('sb:modelPull', l);
  },
};

contextBridge.exposeInMainWorld('sb', bridge);
