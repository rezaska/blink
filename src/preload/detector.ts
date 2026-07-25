import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type DetectorStatus } from '../shared/types'

/**
 * Detector bridge. The renderer can ONLY report derived signals to main — a blink
 * happened, or a status change. It cannot send pixels, frames, or anything else.
 * (Data sovereignty: no image data ever crosses this boundary.)
 */
const api = {
  blink: (): void => ipcRenderer.send(IPC.detectorBlink),
  status: (status: DetectorStatus): void => ipcRenderer.send(IPC.detectorStatus, status)
}

contextBridge.exposeInMainWorld('blinkDetector', api)

export type BlinkDetectorApi = typeof api
