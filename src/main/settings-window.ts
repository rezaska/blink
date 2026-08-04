import { app, BrowserWindow, ipcMain, screen } from 'electron'
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

// Fixed calibration window size, chosen to fit the tallest step (cue tasting) without scroll.
const ONBOARDING_WIDTH = 560
const ONBOARDING_HEIGHT = 640

let win: BrowserWindow | null = null

export type SettingsView = 'auto' | 'onboarding' | 'settings'

export function openSettingsWindow(view: SettingsView = 'auto'): void {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
    return
  }

  win = new BrowserWindow({
    width: 560,
    height: 460,
    minWidth: 460,
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

  const search = `view=${view}`
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(`${devUrl}/settings/index.html?${search}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/settings/index.html'), { search })
  }

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
    const area = screen.getDisplayNearestPoint(win.getBounds()).workArea
    const [w, currentContentH] = win.getContentSize()
    const [, winH] = win.getSize()
    const chromeH = winH - currentContentH // title bar / frame height
    // Use nearly the whole work area (minus the frame + a small margin) so content fits
    // in one shot whenever the screen allows; only truly oversized content then scrolls.
    const maxContentH = Math.max(260, area.height - chromeH - 12)
    const h = Math.max(260, Math.min(Math.ceil(height), maxContentH))
    if (Math.abs(currentContentH - h) > 4) win.setContentSize(w, h, false)
    // Max window height = current content height; still shrinkable (with scroll).
    win.setMaximumSize(area.width, h + chromeH)
  })

  // Calibration/onboarding: a fixed, non-resizable window sized for the tallest step,
  // so nothing resizes or scrolls as you move through the flow.
  ipcMain.on(IPC.onboardingSize, () => {
    if (!win || win.isDestroyed()) return
    win.setResizable(true)
    win.setMaximumSize(0, 0) // clear the content cap so we can grow to the fixed size
    win.setMinimumSize(1, 1)
    win.setContentSize(ONBOARDING_WIDTH, ONBOARDING_HEIGHT)
    win.center()
    win.setResizable(false)
  })
}
