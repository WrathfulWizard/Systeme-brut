import { contextBridge, ipcRenderer } from 'electron';
import type {
  SbBridge, SyncMeta, SourceId, LiftInput, AdminInput, TitrationInput, LabPanelInput,
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
  disconnect: (source: SourceId) => ipcRenderer.invoke('sb:disconnect', source),
  syncNow: (source?: SourceId) => ipcRenderer.invoke('sb:syncNow', source),
  onSyncUpdate: (cb: (m: SyncMeta) => void) => {
    const listener = (_e: unknown, m: SyncMeta) => cb(m);
    ipcRenderer.on('sb:syncUpdate', listener);
    return () => ipcRenderer.removeListener('sb:syncUpdate', listener);
  },
  addSet: (input: LiftInput) => ipcRenderer.invoke('sb:addSet', input),
  addAdministration: (input: AdminInput) => ipcRenderer.invoke('sb:addAdministration', input),
  addTitration: (input: TitrationInput) => ipcRenderer.invoke('sb:addTitration', input),
  addLabPanel: (input: LabPanelInput) => ipcRenderer.invoke('sb:addLabPanel', input),
};

contextBridge.exposeInMainWorld('sb', bridge);
