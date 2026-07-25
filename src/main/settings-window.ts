import { app, BrowserWindow, ipcMain } from 'electron'
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

let win: BrowserWindow | null = null

export type SettingsView = 'auto' | 'onboarding' | 'settings'

export function openSettingsWindow(view: SettingsView = 'auto'): void {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
    return
  }

  win = new BrowserWindow({
    width: 720,
    height: 620,
    minWidth: 560,
    minHeight: 520,
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
}
