import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type CuePayload } from '../shared/types'

/**
 * Minimal, one-way bridge: the overlay renderer can ONLY subscribe to incoming cue
 * events. It has no ability to send, read files, or reach the network.
 */
const api = {
  onCue: (callback: (payload: CuePayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: CuePayload) =>
      callback(payload)
    ipcRenderer.on(IPC.cueFire, listener)
    return () => ipcRenderer.removeListener(IPC.cueFire, listener)
  }
}

contextBridge.exposeInMainWorld('blink', api)

export type BlinkOverlayApi = typeof api
