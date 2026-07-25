import { Menu, Tray, nativeImage, app } from 'electron'
import { snapshot } from './detection'
import { openSettingsWindow } from './settings-window'

let tray: Tray | null = null

/**
 * Phase 3 tray: a live status line plus access to the real Settings window and the
 * calibration flow. (Pause options + icon states arrive in Phase 4.)
 */
export function createTray(): void {
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('◉')
  tray.setToolTip('Blink — ambient blink reminders')
  rebuildMenu()
}

export function rebuildMenu(): void {
  if (!tray) return
  const s = snapshot()

  const menu = Menu.buildFromTemplate([
    { label: 'Blink', enabled: false },
    { label: s.statusText, enabled: false },
    { type: 'separator' },
    { label: 'Open Blink Settings…', click: () => openSettingsWindow('settings') },
    { label: 'Re-run calibration…', click: () => openSettingsWindow('onboarding') },
    { type: 'separator' },
    { label: 'Quit Blink', click: () => app.quit() }
  ])

  tray.setContextMenu(menu)
}
