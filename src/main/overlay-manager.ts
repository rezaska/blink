import { BrowserWindow, screen, type Display } from 'electron'
import { join } from 'node:path'

/**
 * Manages one transparent, click-through, always-on-top overlay window PER display.
 * (One window per display - not one union window - so each gets its own correct
 * scaleFactor and can float over its display's Space; see plan decision 1.)
 *
 * Known macOS limitation: even at `screen-saver` level a panel will not reliably draw
 * over a *true* native-full-screen app (which lives in its own Space). Coverage is
 * reliable over normal Spaces and maximized/windowed video.
 */

const overlays = new Map<number, BrowserWindow>()

function overlayHtmlDev(): string | null {
  const base = process.env['ELECTRON_RENDERER_URL']
  return base ? `${base}/overlay/index.html` : null
}

function loadOverlay(win: BrowserWindow): void {
  const devUrl = overlayHtmlDev()
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/overlay/index.html'))
  }
}

function createOverlayForDisplay(display: Display): BrowserWindow {
  const { x, y, width, height } = display.bounds

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    transparent: true,
    frame: false,
    hasShadow: false,
    focusable: false,
    fullscreenable: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    roundedCorners: false,
    enableLargerThanScreen: true,
    acceptFirstMouse: false,
    backgroundColor: '#00000000',
    // 'panel' (NSPanel) floats above Spaces better than a normal window on macOS.
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/overlay.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setIgnoreMouseEvents(true, { forward: true })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  })

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[overlay ${display.id}] did-fail-load`, code, desc, url)
  })

  loadOverlay(win)
  // Show without stealing focus. `ready-to-show` can be unreliable for transparent
  // windows, so also show once content has loaded as a fallback.
  const show = () => {
    if (!win.isDestroyed() && !win.isVisible()) win.showInactive()
  }
  win.once('ready-to-show', show)
  win.webContents.once('did-finish-load', show)

  return win
}

function rebuild(): void {
  destroyOverlays()
  for (const display of screen.getAllDisplays()) {
    overlays.set(display.id, createOverlayForDisplay(display))
  }
}

export function initOverlays(): void {
  rebuild()
  // Re-derive the overlay set whenever the display topology changes.
  screen.on('display-added', rebuild)
  screen.on('display-removed', rebuild)
  screen.on('display-metrics-changed', rebuild)
}

export function destroyOverlays(): void {
  for (const win of overlays.values()) {
    if (!win.isDestroyed()) win.destroy()
  }
  overlays.clear()
}

/** Live overlay windows (used by the cue controller to broadcast cues). */
export function overlayWindows(): BrowserWindow[] {
  return [...overlays.values()].filter((w) => !w.isDestroyed())
}
