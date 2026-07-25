import { app, net, protocol } from 'electron'
import { join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Custom `app://` scheme used to serve bundled local assets (MediaPipe WASM + model
 * in Phase 2, static assets generally) with correct MIME types and without touching
 * the network. Registered privileged so it can stream WASM and satisfy CSP/fetch.
 *
 * URL shape: app://blink/<relative-path-under-resources>
 */

const SCHEME = 'app'
const HOST = 'blink'

/** Base directory for served assets: `resources/` in dev, `process.resourcesPath` when packaged. */
function assetRoot(): string {
  return app.isPackaged
    ? process.resourcesPath
    : join(app.getAppPath(), 'resources')
}

/** Must be called at top level BEFORE app `ready`. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true
      }
    }
  ])
}

const MIME: Record<string, string> = {
  '.wasm': 'application/wasm',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.task': 'application/octet-stream',
  '.data': 'application/octet-stream',
  '.html': 'text/html',
  '.css': 'text/css'
}

/** Must be called AFTER app `ready`. */
export function registerAppProtocol(): void {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.hostname !== HOST) {
      return new Response('Not found', { status: 404 })
    }
    // Resolve + contain the path within assetRoot to prevent traversal.
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
    const root = assetRoot()
    const filePath = join(root, rel)
    if (!filePath.startsWith(root)) {
      return new Response('Forbidden', { status: 403 })
    }

    const res = await net.fetch(pathToFileURL(filePath).toString())
    // Force correct MIME so WebAssembly.instantiateStreaming works for .wasm.
    const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase()
    const mime = MIME[ext]
    if (mime) {
      const headers = new Headers(res.headers)
      headers.set('Content-Type', mime)
      return new Response(res.body, { status: res.status, headers })
    }
    return res
  })
}
