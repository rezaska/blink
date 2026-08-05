/**
 * Render build/icon.svg to build/icon.png at 1024x1024 using Chromium (Electron),
 * which renders SVG (gradients, stroked paths) faithfully. Run:
 *   unset ELECTRON_RUN_AS_NODE; ./node_modules/.bin/electron scripts/render-icon.cjs
 */
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SIZE = 1024
const root = join(__dirname, '..')
const svg = readFileSync(join(root, 'build/icon.svg'), 'utf8')
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent}
  svg{width:${SIZE}px;height:${SIZE}px;display:block}
</style></head><body>${svg}</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {}
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 400)) // let it paint
  let img = await win.webContents.capturePage()
  const s = img.getSize()
  if (s.width !== SIZE || s.height !== SIZE) img = img.resize({ width: SIZE, height: SIZE })
  writeFileSync(join(root, 'build/icon.png'), img.toPNG())
  console.log('wrote build/icon.png at', img.getSize())
  app.quit()
})
