/**
 * Render monochrome menu-bar (tray) icons to resources/tray/ as macOS template images
 * (black on transparent; macOS recolors them for light/dark). Rendered via Chromium so
 * the SVG strokes are faithful. Run:
 *   unset ELECTRON_RUN_AS_NODE; ./node_modules/.bin/electron scripts/render-tray-icons.cjs
 */
const { app, BrowserWindow } = require('electron')
const { writeFileSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')

const outDir = join(__dirname, '..', 'resources', 'tray')
const RENDER = 64 // render big, downscale to 16/32 for crisp edges

const stroke =
  'fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'
const EYE_OPEN = `<path ${stroke} d="M4 16 C10 8, 22 8, 28 16 C22 24, 10 24, 4 16 Z"/><circle cx="16" cy="16" r="4.2" fill="#000"/>`
const ICONS = {
  'eye-open': EYE_OPEN, // monitoring
  'eye-closed': `<g ${stroke}><path d="M5 14 C11 21, 21 21, 27 14"/><path d="M8 19 L7 22"/><path d="M16 20.5 L16 24"/><path d="M24 19 L25 22"/></g>`, // paused
  'eye-slash': `${EYE_OPEN}<line ${stroke} x1="6" y1="26" x2="26" y2="6"/>` // no camera
}

function page(inner) {
  return (
    '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>' +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${RENDER}" height="${RENDER}" viewBox="0 0 32 32">${inner}</svg>`
  )
}

app.whenReady().then(async () => {
  mkdirSync(outDir, { recursive: true })
  const win = new BrowserWindow({ width: RENDER, height: RENDER, show: false, frame: false, transparent: true })
  try {
    for (const [name, inner] of Object.entries(ICONS)) {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page(inner)))
      await new Promise((r) => setTimeout(r, 200))
      const shot = await win.webContents.capturePage()
      writeFileSync(join(outDir, `${name}Template.png`), shot.resize({ width: 16, height: 16 }).toPNG())
      writeFileSync(join(outDir, `${name}Template@2x.png`), shot.resize({ width: 32, height: 32 }).toPNG())
      console.log('wrote', name)
    }
  } catch (err) {
    console.error('render error:', err)
  } finally {
    win.destroy()
    app.quit()
  }
})
