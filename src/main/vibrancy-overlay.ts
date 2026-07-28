import { BrowserWindow, screen, type Display } from 'electron'
import { envelopeAt, totalDurationMs, DEFAULT_TIMING, type CueTiming } from '../shared/cue-timing'

/**
 * macOS "real frost" blur cue. A true `NSVisualEffectView` (vibrancy) actually blurs the
 * desktop content behind it - but its blur radius is fixed and can't be animated. So we
 * render a full-screen, click-through vibrancy window per display and crossfade its whole
 * opacity along the cue envelope (a fade of real frost, not a radius pulse).
 *
 * Windows are created lazily (only if the user enables the option) and hidden between cues.
 */

const windows = new Map<number, BrowserWindow>()
let anim: ReturnType<typeof setInterval> | null = null
let listenersBound = false

function createVibrancyWindow(display: Display): BrowserWindow {
  const { x, y, width, height } = display.bounds
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    opacity: 0,
    frame: false,
    hasShadow: false,
    focusable: false,
    fullscreenable: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    roundedCorners: false,
    enableLargerThanScreen: true,
    type: 'panel',
    vibrancy: 'under-window',
    visualEffectState: 'active', // keep the material live even though we never focus
    webPreferences: { backgroundThrottling: false }
  })
  win.setIgnoreMouseEvents(true, { forward: true })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  // Empty local page - the vibrancy material fills the window; nothing to render.
  void win.loadURL('data:text/html,<!doctype html><meta charset="utf-8">')
  return win
}

function ensureWindows(): BrowserWindow[] {
  if (windows.size === 0) {
    for (const d of screen.getAllDisplays()) windows.set(d.id, createVibrancyWindow(d))
  }
  if (!listenersBound) {
    listenersBound = true
    // On any display change, tear down; the next cue rebuilds for the new layout.
    const rebuild = () => destroyVibrancyOverlays()
    screen.on('display-added', rebuild)
    screen.on('display-removed', rebuild)
    screen.on('display-metrics-changed', rebuild)
  }
  return [...windows.values()].filter((w) => !w.isDestroyed())
}

/** Crossfade the frosted overlay in and out along the cue envelope. */
export function fireVibrancyBlur(intensity = 1, timing: CueTiming = DEFAULT_TIMING): void {
  const wins = ensureWindows()
  if (wins.length === 0) return
  const peak = Math.max(0, Math.min(1, intensity))
  const total = totalDurationMs(timing)
  const start = Date.now()

  for (const w of wins) w.showInactive()
  if (anim) clearInterval(anim)
  anim = setInterval(() => {
    const elapsed = Date.now() - start
    const value = envelopeAt(elapsed, timing) * peak
    for (const w of wins) if (!w.isDestroyed()) w.setOpacity(value)
    if (elapsed >= total) {
      if (anim) clearInterval(anim)
      anim = null
      for (const w of wins) {
        if (!w.isDestroyed()) {
          w.setOpacity(0)
          w.hide()
        }
      }
    }
  }, 16)
}

export function destroyVibrancyOverlays(): void {
  if (anim) clearInterval(anim)
  anim = null
  for (const w of windows.values()) if (!w.isDestroyed()) w.destroy()
  windows.clear()
}
