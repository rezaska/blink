import {
  Menu,
  Tray,
  nativeImage,
  shell,
  app,
  type NativeImage,
  type MenuItemConstructorOptions
} from 'electron'
import { join } from 'node:path'
import { snapshot, pauseFor, pauseUntilTomorrow, resume, type TrayState } from './detection'
import { openSettingsWindow } from './settings-window'

const MIN = 60_000
// Opened in the user's browser via shell.openExternal — the app itself makes no request.
const KOFI_URL = 'https://ko-fi.com/rezasoleimani'

let tray: Tray | null = null
let flashTimer: ReturnType<typeof setTimeout> | null = null
let icons: Record<'open' | 'closed' | 'slash', NativeImage>
let currentImage: NativeImage

/**
 * Menu-bar icon = a monochrome eye template (matches the app icon). macOS recolors
 * template images for light/dark menu bars automatically.
 *   monitoring → open eye   paused → closed eye   no-camera → eye with slash
 * A cue briefly flashes the closed eye (a blink).
 */
const STATE_ICON: Record<TrayState, 'open' | 'closed' | 'slash'> = {
  monitoring: 'open',
  paused: 'closed',
  'no-camera': 'slash'
}

function trayIconDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tray')
    : join(app.getAppPath(), 'resources', 'tray')
}

function loadIcon(file: string): NativeImage {
  const img = nativeImage.createFromPath(join(trayIconDir(), file)) // auto-loads @2x
  img.setTemplateImage(true)
  return img
}

export function createTray(): void {
  icons = {
    open: loadIcon('eye-openTemplate.png'),
    closed: loadIcon('eye-closedTemplate.png'),
    slash: loadIcon('eye-slashTemplate.png')
  }
  currentImage = icons.open
  tray = new Tray(currentImage)
  tray.setToolTip('Blink - ambient blink reminders')
  rebuildMenu()
}

function applyState(state: TrayState): void {
  currentImage = icons[STATE_ICON[state]]
  if (flashTimer) return // don't stomp an in-progress blink flash
  tray?.setImage(currentImage)
}

/** Briefly blink (closed eye) in the menu bar when a cue fires. */
export function flashCue(): void {
  if (!tray) return
  if (flashTimer) clearTimeout(flashTimer)
  tray.setImage(icons.closed)
  flashTimer = setTimeout(() => {
    flashTimer = null
    tray?.setImage(currentImage)
  }, 240)
}

export function rebuildMenu(): void {
  if (!tray) return
  const s = snapshot()
  applyState(s.trayState)
  tray.setToolTip(`Blink - ${s.statusText}`)

  const pauseSection: MenuItemConstructorOptions[] = s.paused
    ? [{ label: `Resume (paused until ${s.resumeText})`, click: () => resume() }]
    : [
        {
          label: 'Pause',
          submenu: [
            { label: 'For 30 minutes', click: () => pauseFor(30 * MIN) },
            { label: 'For 1 hour', click: () => pauseFor(60 * MIN) },
            { label: 'Until tomorrow', click: () => pauseUntilTomorrow() }
          ]
        }
      ]

  const menu = Menu.buildFromTemplate([
    { label: 'Blink', enabled: false },
    { label: s.statusText, enabled: false },
    { type: 'separator' },
    ...pauseSection,
    { type: 'separator' },
    { label: 'Blink Settings', click: () => openSettingsWindow('settings') },
    { label: 'Support Blink ↗', click: () => void shell.openExternal(KOFI_URL) },
    { type: 'separator' },
    { label: 'Quit Blink', click: () => app.quit() }
  ])

  tray.setContextMenu(menu)
}
