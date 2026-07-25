import { systemPreferences, session } from 'electron'

/**
 * Camera permission is only ever touched when the user opts into webcam mode.
 *
 * Two layers on macOS: the OS-level TCC prompt (via `askForMediaAccess`) and
 * Electron's per-session permission handler (for the renderer's `getUserMedia`).
 */

/** Grant renderer `media` permission requests (only the detector ever asks). */
export function installPermissionHandler(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })
  // Belt-and-braces for synchronous checks (Electron ≥ some versions).
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media')
}

export type CameraAccess = 'granted' | 'denied'

/**
 * Ensure OS camera access, prompting once if undetermined. Returns 'denied' rather
 * than throwing so callers can gracefully fall back to Timer mode.
 */
export async function ensureCameraAccess(): Promise<CameraAccess> {
  if (process.platform !== 'darwin') {
    // On Windows/Linux the OS handles the prompt at getUserMedia time.
    return 'granted'
  }
  const status = systemPreferences.getMediaAccessStatus('camera')
  if (status === 'granted') return 'granted'
  if (status === 'denied' || status === 'restricted') return 'denied'
  try {
    const ok = await systemPreferences.askForMediaAccess('camera')
    return ok ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}
