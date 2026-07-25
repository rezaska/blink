import { BrowserWindow } from 'electron'
import { join } from 'node:path'

/**
 * The hidden webcam-detector window. Created ONLY when the user is in webcam mode;
 * destroyed the moment they leave it (so the camera is fully released and never even
 * instantiated in Timer mode).
 */

let detector: BrowserWindow | null = null

export function createDetectorWindow(): void {
  if (detector && !detector.isDestroyed()) return

  detector = new BrowserWindow({
    show: false,
    width: 320,
    height: 240,
    webPreferences: {
      preload: join(__dirname, '../preload/detector.js'),
      backgroundThrottling: false, // keep inference running while hidden
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Surface detector-renderer logs/errors (WASM load, camera) in the main terminal.
  detector.webContents.on('console-message', (_e, _level, message) => {
    console.log('[detector]', message)
  })
  detector.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[detector] did-fail-load', code, desc, url)
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void detector.loadURL(`${devUrl}/detector/index.html`)
  } else {
    void detector.loadFile(join(__dirname, '../renderer/detector/index.html'))
  }
}

export function destroyDetectorWindow(): void {
  if (detector && !detector.isDestroyed()) detector.destroy()
  detector = null
}

export function isDetectorAlive(): boolean {
  return detector !== null && !detector.isDestroyed()
}
