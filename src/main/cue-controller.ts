import { overlayWindows } from './overlay-manager'
import { fireVibrancyBlur } from './vibrancy-overlay'
import { IPC, type CuePayload } from '../shared/types'

/**
 * Single choke point for all cues - the tray, the trigger engine, and Settings "Preview"
 * all call `fireCue`. A blur cue with the macOS "real frost" preference is routed to the
 * native vibrancy overlay; every other cue renders in the CSS overlay windows.
 */
export function fireCue(payload: CuePayload): void {
  if (process.platform === 'darwin' && payload.type === 'blur' && payload.strongFrost) {
    fireVibrancyBlur(payload.intensity ?? 1, payload.timing)
    return
  }
  for (const win of overlayWindows()) {
    win.webContents.send(IPC.cueFire, payload)
  }
}
