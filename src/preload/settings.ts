import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Settings, type StatsSummary, type CuePayload } from '../shared/types'

/** Bridge for the settings/onboarding window. All calls are local IPC to main. */
const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.getSettings),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke(IPC.setSettings, patch),
  getStats: (): Promise<StatsSummary> => ipcRenderer.invoke(IPC.getStats),
  getInitialView: (): Promise<'onboarding' | 'settings'> =>
    ipcRenderer.invoke(IPC.getInitialView),
  previewCue: (payload: CuePayload): void => ipcRenderer.send(IPC.previewCue, payload),
  requestCamera: (): Promise<'granted' | 'denied'> => ipcRenderer.invoke(IPC.requestCamera),
  revealDataFolder: (): void => ipcRenderer.send(IPC.revealDataFolder),
  exportData: (): Promise<{ ok: boolean; path?: string }> => ipcRenderer.invoke(IPC.exportData),
  deleteAllData: (): Promise<void> => ipcRenderer.invoke(IPC.deleteAllData),
  finishOnboarding: (settings: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke(IPC.finishOnboarding, settings),
  close: (): void => ipcRenderer.send(IPC.closeSettings),
  resize: (height: number): void => ipcRenderer.send(IPC.resizeSettings, height),
  onboardingSize: (): void => ipcRenderer.send(IPC.onboardingSize),
  openPrivacy: (): void => ipcRenderer.send(IPC.openPrivacy)
}

contextBridge.exposeInMainWorld('blinkSettings', api)

export type BlinkSettingsApi = typeof api
