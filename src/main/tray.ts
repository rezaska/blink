import { Menu, Tray, nativeImage, app } from 'electron'
import { snapshot, type TrayState } from './detection'
import { openSettingsWindow } from './settings-window'

let tray: Tray | null = null
let currentTitle = '◉'
let flashTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Menu-bar icon states. macOS menu-bar glyphs (crisp + theme-adaptive) stand in for
 * bespoke eye artwork; `setTrayState` is the single seam where real template PNGs could
 * later replace the glyphs.
 *   monitoring → ◉   paused → ◌   no-camera → ⊘   (blink flash → –)
 */
const GLYPH: Record<TrayState, string> = {
  monitoring: '◉',
  paused: '◌',
  'no-camera': '⊘'
}

function applyState(state: TrayState): void {
  currentTitle = GLYPH[state] ?? '◉'
  if (flashTimer) return // don't stomp an in-progress blink flash
  tray?.setTitle(currentTitle)
}

/** Briefly animate a "blink" in the menu bar when a cue fires. */
export function flashCue(): void {
  if (!tray) return
  if (flashTimer) clearTimeout(flashTimer)
  tray.setTitle('–')
  flashTimer = setTimeout(() => {
    flashTimer = null
    tray?.setTitle(currentTitle)
  }, 240)
}

export function createTray(): void {
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle(currentTitle)
  tray.setToolTip('Blink — ambient blink reminders')
  rebuildMenu()
}

export function rebuildMenu(): void {
  if (!tray) return
  const s = snapshot()
  applyState(s.trayState)
  tray.setToolTip(`Blink — ${s.statusText}`)

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
