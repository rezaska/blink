# Packaging (macOS .dmg)

Blink is packaged with **electron-builder** into a `.dmg`. The current build is
**unsigned** (ad-hoc signed so it launches on Apple Silicon); Developer ID signing +
notarization can be added later.

## Build it

```bash
nvm use            # Node 22
npm install
npm run assets     # one-time: fetch MediaPipe WASM + model into resources/ (needed by the build)
npm run package    # electron-vite build + electron-builder --mac
```

Output lands in `dist/`:
- `dist/Blink-<version>-arm64.dmg` — the installer
- `dist/mac-arm64/Blink.app` — the app bundle

## Install / run

Open the `.dmg` and drag **Blink** to Applications. Because the build isn't
notarized, the **first launch** needs: right-click the app → **Open** → **Open**
(afterwards it opens normally). Then Blink lives in the menu bar.

## How it's configured

- `electron-builder.yml` — targets `dmg`, bundles the app icon (`build/icon.png` →
  `.icns`), sets the camera usage string (`NSCameraUsageDescription`), and copies
  `resources/` (WASM, model, tray icons) via `extraResources` into
  `Contents/Resources/` (where the app loads them from `process.resourcesPath`).
- `build/after-pack.cjs` — ad-hoc code-signs the app (required to launch on arm64
  without a Developer ID).
- `build/entitlements.mac.plist` — for a **future** signed + notarized build
  (camera + JIT under hardened runtime). Not used by the unsigned build.

## Known limits of the unsigned build

- First launch requires the right-click → Open step (Gatekeeper).
- **Launch at login** may not register for an ad-hoc app; it works reliably only in a
  signed build.

## To sign + notarize later

1. Get an Apple Developer ID, set `CSC_LINK` / `CSC_KEY_PASSWORD` (or a keychain identity).
2. In `electron-builder.yml`: remove `mac.identity: null`, set `mac.hardenedRuntime: true`,
   and add `mac.entitlements` / `mac.entitlementsInherit: build/entitlements.mac.plist`.
3. Add notarization (`APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`).
