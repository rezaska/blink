import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { join } from 'node:path'
import { IPC, type Settings, type CuePayload } from '../shared/types'
import {
  getSettings,
  setSettings,
  getStatsSummary,
  revealDataFolder,
  exportData,
  deleteAllData
} from './store'
import { applySettings, previewCue } from './detection'
import { ensureCameraAccess } from './permissions'

/** The settings + onboarding window (a normal, focusable window). */

// Fixed width for both settings and calibration; width is never user-resizable.
const WINDOW_WIDTH = 560
// Opened in the user's browser via shell.openExternal — the app makes no request itself.
const PRIVACY_URL = 'https://www.rezasoleimani.ca/blink/privacy/'
const KOFI_URL = 'https://ko-fi.com/rezasoleimani'
// Fixed calibration height, chosen to fit the tallest step (cue tasting) without scroll.
const ONBOARDING_HEIGHT = 640

let win: BrowserWindow | null = null

export type SettingsView = 'auto' | 'onboarding' | 'settings' | 'support'

function loadView(w: BrowserWindow, view: SettingsView): void {
  const search = `view=${view}`
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void w.loadURL(`${devUrl}/settings/index.html?${search}`)
  } else {
    void w.loadFile(join(__dirname, '../renderer/settings/index.html'), { search })
  }
}

export function openSettingsWindow(view: SettingsView = 'auto'): void {
  if (win && !win.isDestroyed()) {
    loadView(win, view) // navigate to the requested view even if a window is already open
    win.show()
    win.focus()
    return
  }

  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: 460,
    minWidth: WINDOW_WIDTH,
    maxWidth: WINDOW_WIDTH, // lock the width; only height adapts
    minHeight: 260,
    useContentSize: true, // size the content area, not incl. the title bar
    title: 'Blink',
    show: false,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.webContents.on('console-message', (_e, _level, message) => {
    console.log('[settings]', message)
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[settings] did-fail-load', code, desc, url)
  })

  loadView(win, view)

  // Show the Dock icon while a real window is open so it can be focused / cmd-tabbed.
  app.dock?.show()
  win.once('ready-to-show', () => {
    win?.show()
    win?.focus()
  })
  win.on('closed', () => {
    win = null
    app.dock?.hide()
  })
}

export function closeSettingsWindow(): void {
  if (win && !win.isDestroyed()) win.close()
}

/** Register all settings/onboarding IPC handlers once, at startup. */
export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.getSettings, () => getSettings())

  ipcMain.handle(IPC.setSettings, async (_e, patch: Partial<Settings>) => {
    const next = setSettings(patch)
    await applySettings()
    return next
  })

  ipcMain.handle(IPC.getStats, () => getStatsSummary())

  ipcMain.handle(IPC.getInitialView, () => (getSettings().onboarded ? 'settings' : 'onboarding'))

  ipcMain.on(IPC.previewCue, (_e, payload: CuePayload) => previewCue(payload))

  ipcMain.handle(IPC.requestCamera, () => ensureCameraAccess())

  ipcMain.on(IPC.revealDataFolder, () => revealDataFolder())

  ipcMain.handle(IPC.exportData, () => exportData(win))

  ipcMain.handle(IPC.deleteAllData, async () => {
    deleteAllData()
    await applySettings()
  })

  ipcMain.handle(IPC.finishOnboarding, async (_e, patch: Partial<Settings>) => {
    const next = setSettings({ ...patch, onboarded: true })
    await applySettings()
    return next
  })

  ipcMain.on(IPC.openPrivacy, () => void shell.openExternal(PRIVACY_URL))
  ipcMain.on(IPC.openKofi, () => void shell.openExternal(KOFI_URL))

  ipcMain.on(IPC.closeSettings, () => {
    // Menu-bar app: closing the window just hides the UI; app keeps running.
    closeSettingsWindow()
    app.dock?.hide()
  })

  // Resize the window to fit the full rendered content so everything shows at once.
  // Capped to ~90% of the screen's work area; taller content then scrolls (small screens).
  // Also cap the window's max height to the content, so it can't be dragged taller than needed.
  ipcMain.on(IPC.resizeSettings, (_e, height: number) => {
    if (!win || win.isDestroyed()) return
    win.setResizable(true) // fitWindow is only used by resizable views; undo any onboarding lock
    const area = screen.getDisplayNearestPoint(win.getBounds()).workArea
    const [, currentContentH] = win.getContentSize()
    const [winW, winH] = win.getSize()
    const chromeH = winH - currentContentH // title bar / frame height
    const chromeW = winW - WINDOW_WIDTH // side frame width (0 on macOS)
    // Use nearly the whole work area (minus the frame + a small margin) so content fits
    // in one shot whenever the screen allows; only truly oversized content then scrolls.
    const maxContentH = Math.max(260, area.height - chromeH - 12)
    const h = Math.max(260, Math.min(Math.ceil(height), maxContentH))
    if (Math.abs(currentContentH - h) > 4) win.setContentSize(WINDOW_WIDTH, h, false)
    // Lock width; height ranges from 260 up to the content height (shrinkable, then scrolls).
    win.setMinimumSize(WINDOW_WIDTH + chromeW, 260)
    win.setMaximumSize(WINDOW_WIDTH + chromeW, h + chromeH)
  })

  // Calibration/onboarding: a fixed, non-resizable window sized for the tallest step,
  // so nothing resizes or scrolls as you move through the flow.
  ipcMain.on(IPC.onboardingSize, () => {
    if (!win || win.isDestroyed()) return
    win.setResizable(true)
    win.setMaximumSize(0, 0) // clear the content cap so we can grow to the fixed size
    win.setMinimumSize(1, 1)
    win.setContentSize(WINDOW_WIDTH, ONBOARDING_HEIGHT)
    win.center()
    win.setResizable(false)
  })
}
