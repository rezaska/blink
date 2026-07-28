import { app, session, type Session } from 'electron'

/**
 * Data-sovereignty kill-switch. Blocks ALL outbound network requests except the
 * local schemes the app legitimately uses. This makes the "no network calls at all"
 * guarantee enforceable and auditable rather than merely asserted.
 *
 * In development we additionally allow the electron-vite dev server + HMR socket on
 * localhost, because the renderer is served over http/ws there. In a packaged build
 * (`app.isPackaged`) nothing on the network is ever allowed - no hostnames, no CDNs.
 */

const LOCAL_SCHEMES = new Set([
  'app:',
  'file:',
  'devtools:',
  'blob:',
  'data:',
  'chrome-extension:'
])

function isAllowed(rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  if (LOCAL_SCHEMES.has(url.protocol)) return true

  // Dev-only: permit the local Vite dev server and HMR websocket.
  if (!app.isPackaged) {
    const host = url.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  }
  return false
}

function guardSession(ses: Session): void {
  ses.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowed(details.url)
    if (!allowed) {
      console.warn('[network-guard] blocked outbound request:', details.url)
    }
    callback({ cancel: !allowed })
  })
}

/**
 * Install the guard on the default session and on every future session
 * (e.g. the opt-in detector's partition), so no renderer can slip past it.
 */
export function installNetworkGuard(): void {
  guardSession(session.defaultSession)
  app.on('session-created', guardSession)
}
