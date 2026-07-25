import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'

/**
 * Injects a Content-Security-Policy meta tag into renderer HTML. Strict in a packaged
 * build (no network origins at all); in dev it additionally permits the Vite dev server
 * + HMR websocket on localhost. The network-guard in the main process is the hard
 * enforcement layer; this CSP is defense-in-depth.
 */
function buildCsp(isDetector: boolean, dev: boolean): string {
  const localConnect = dev ? ' ws://localhost:* http://localhost:*' : ''
  const devScript = dev ? " 'unsafe-inline'" : ''
  if (isDetector) {
    // Detector needs to load local WASM (app:), compile it, and read the camera stream.
    return [
      "default-src 'none'",
      `script-src 'self' 'wasm-unsafe-eval' app: blob:${devScript}`,
      `connect-src 'self' app: blob:${localConnect}`,
      "img-src 'self' data: blob:",
      "media-src 'self' blob: mediastream:",
      "worker-src blob:",
      "style-src 'self' 'unsafe-inline'"
    ].join('; ')
  }
  return [
    "default-src 'none'",
    `script-src 'self'${devScript}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self'${localConnect}`
  ].join('; ')
}

function cspPlugin(): Plugin {
  return {
    name: 'blink-csp',
    transformIndexHtml(html, ctx) {
      const dev = ctx.server != null
      const isDetector = (ctx.path ?? ctx.filename ?? '').includes('detector')
      const csp = buildCsp(isDetector, dev)
      return html.replace(
        '<!--CSP-->',
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`
      )
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/preload/overlay.ts'),
          detector: resolve(__dirname, 'src/preload/detector.ts'),
          settings: resolve(__dirname, 'src/preload/settings.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [cspPlugin()],
    build: {
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html'),
          detector: resolve(__dirname, 'src/renderer/detector/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings/index.html')
        }
      }
    }
  }
})
