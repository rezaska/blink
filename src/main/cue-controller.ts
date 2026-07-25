import { overlayWindows } from './overlay-manager'
import { IPC, type CuePayload } from '../shared/types'

/**
 * Broadcasts a cue to every overlay window so it fires simultaneously on all
 * displays. This is the single choke point through which all cues flow — the tray
 * (Phase 1), the trigger engine (Phase 2), and Settings "Preview" (Phase 3) all
 * call `fireCue`.
 */
export function fireCue(payload: CuePayload): void {
  for (const win of overlayWindows()) {
    win.webContents.send(IPC.cueFire, payload)
  }
}
