/**
 * Ad-hoc code-sign the packaged .app after electron-builder assembles it.
 *
 * On Apple Silicon a macOS app must carry at least an ad-hoc signature to launch;
 * electron-builder leaves it unsigned when there is no Developer ID (`identity: null`),
 * so we sign it here (before the .dmg is built). This is NOT notarization — the first
 * launch still needs a right-click -> Open to get past Gatekeeper.
 */
const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename // "Blink"
  const appPath = join(context.appOutDir, `${appName}.app`)
  console.log('[after-pack] ad-hoc signing', appPath)
  execFileSync('codesign', ['--deep', '--force', '--sign', '-', appPath], { stdio: 'inherit' })
}
