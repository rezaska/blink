/**
 * Release helper: build, package, checksum, update the download page, and publish a
 * GitHub Release with the .dmg. Run it with Node 22 and an authenticated `gh` CLI.
 *
 * Usage:
 *   npm run release            # release the current package.json version
 *   npm run release 0.2.0      # bump package.json to 0.2.0, then release
 *
 * What it does:
 *   1. (optional) bump the version in package.json
 *   2. npm run package  ->  dist/Blink-<version>-arm64.dmg  (ad-hoc signed)
 *   3. compute the SHA-256 checksum
 *   4. update web/download/index.html (download link, version, size, checksum)
 *   5. commit + push the version/page changes
 *   6. create a GitHub Release (tag v<version>) with the .dmg attached
 *
 * Note: releasing a version that already has a tag/release will fail at step 6 —
 * delete the existing release + tag first, or bump to a new version.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'rezaska/blink'

// Don't let a globally-set ELECTRON_RUN_AS_NODE leak into the build tooling.
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', env })
const capture = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', env }).trim()

// 1. Version
const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const version = process.argv[2] ?? pkg.version
if (process.argv[2] && pkg.version !== version) {
  pkg.version = version
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`• bumped version to ${version}`)
}
const tag = `v${version}`
const dmgName = `Blink-${version}-arm64.dmg`

// 2. Build + package
console.log('• building + packaging (this downloads Electron on first run)…')
run('npm', ['run', 'package'])

// 3. Locate the dmg + checksum
const dmgPath = join(root, 'dist', dmgName)
const sizeMB = Math.round(statSync(dmgPath).size / 1e6)
const sha = createHash('sha256').update(readFileSync(dmgPath)).digest('hex')
console.log(`• ${dmgName}  ${sizeMB} MB\n  sha256=${sha}`)

// 4. Update the download page
const dlPath = join(root, 'web/download/index.html')
const html = readFileSync(dlPath, 'utf8')
  .replace(/releases\/download\/v[0-9.]+\/Blink-[0-9.]+-arm64\.dmg/g, `releases/download/${tag}/${dmgName}`)
  .replace(
    /Version [0-9.]+ &middot; Apple Silicon \(M1\/M2\/M3\/M4\) &middot; [0-9]+ MB/,
    `Version ${version} &middot; Apple Silicon (M1/M2/M3/M4) &middot; ${sizeMB} MB`
  )
  .replace(/<code>[a-f0-9]{64}<\/code>/, `<code>${sha}</code>`)
writeFileSync(dlPath, html)
console.log('• updated web/download/index.html')

// 5. Commit + push (only if something actually changed)
run('git', ['add', 'package.json', 'web/download/index.html'])
if (capture('git', ['diff', '--cached', '--name-only'])) {
  run('git', ['commit', '-m', `Release ${tag}`])
  run('git', ['push', 'origin', 'HEAD'])
} else {
  console.log('• no file changes to commit')
}

// 6. GitHub Release
const notes = [
  'A private macOS menu-bar app that gently reminds you to blink so your eyes don\'t dry out.',
  '',
  '## Download',
  `**${dmgName}** — for Apple Silicon (M1/M2/M3/M4).`,
  '',
  `SHA-256: \`${sha}\``,
  '',
  '## Install',
  '1. Open the `.dmg` and drag **Blink** into Applications.',
  '2. This build isn\'t notarized, so the first launch is blocked. Open **System Settings → Privacy & Security** and click **"Open Anyway"** next to the Blink message. (Or run `xattr -dr com.apple.quarantine /Applications/Blink.app`.)',
  '3. Blink lives in your menu bar.',
  '',
  'Privacy: https://www.rezasoleimani.ca/blink/privacy/'
].join('\n')

run('gh', ['release', 'create', tag, dmgPath, '--repo', REPO, '--title', `Blink ${version}`, '--notes', notes])
console.log(`\n✓ Released ${tag} — https://github.com/${REPO}/releases/tag/${tag}`)
