// src/preload/index.ts - Secure preload bridge
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, AppConfig, LogEvent } from '../shared/types';

/**
 * Exposed API for the renderer process.
 * Only exposes specific IPC calls, never raw Node.js or Electron APIs.
 */
const api = {
  // Configuration
  getConfig: (): Promise<AppConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  saveConfig: (updates: Partial<AppConfig>): Promise<AppConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONFIG, updates),

  // Automation control
  startAutomation: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.START_AUTOMATION),
  stopAutomation: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.STOP_AUTOMATION),

  // Data queries
  getStats: (): Promise<unknown> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_STATS),
  getRuns: (limit?: number): Promise<unknown[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_RUNS, limit),
  getGameState: (): Promise<unknown> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_GAME_STATE),
  clearRuns: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_RUNS),

  // Event subscriptions
  onAutomationStateChanged: (callback: (state: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: string) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.AUTOMATION_STATE_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTOMATION_STATE_CHANGED, listener);
  },
  onGameStateUpdated: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.GAME_STATE_UPDATED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.GAME_STATE_UPDATED, listener);
  },
  onLogEvent: (callback: (event: LogEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, logEvent: LogEvent) => callback(logEvent);
    ipcRenderer.on(IPC_CHANNELS.LOG_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_EVENT, listener);
  },
  onRunCompleted: (callback: (run: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, run: unknown) => callback(run);
    ipcRenderer.on(IPC_CHANNELS.RUN_COMPLETED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RUN_COMPLETED, listener);
  },
  onError: (callback: (error: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on(IPC_CHANNELS.ERROR, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ERROR, listener);
  },
};

contextBridge.exposeInMainWorld('autoPokeApi', api);

export type AutoPokeApi = typeof api;
