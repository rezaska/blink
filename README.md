# Blink 👁️

**Ambient blink reminders that keep your eyes from drying out — without breaking your focus.**

When we concentrate on a screen we blink up to 4× less than normal (as few as 4–5 times
per minute vs. a healthy 15–20), which leaves eyes dry, tired, and sore — "computer vision
syndrome". Blink watches how often you blink and nudges you with a *subtle, ambient* screen
cue when you've gone too long — a soft frosted pulse, a gentle dim, or a breathing edge glow.
Never a popup.

The cue design is based on the CHI 2014 study *"Stimulating a Blink"* (Crnovrsanin, Wang &
Ma, UC Davis): ambient cues raise blink rate, screen-blur works best, and interruptive
popups are the worst (people just disable them). Cues fade slowly (~1.5s in, brief hold,
~1.5s out) so they register in your peripheral awareness without pulling you out of flow.

## Private by design 🔒

Blink is built so your data never leaves your machine — and so you can *verify* that:

- **No network connections at all.** A global outbound-network kill-switch blocks every
  request that isn't a local `app://`/`file://` asset. Check it yourself with Little Snitch
  or `nettop` — you'll see nothing leave.
- **The webcam is optional and off by default.** Blink works fully in Timer mode with no
  camera. If you turn on webcam detection, it's requested only then.
- **Frames never persist or leave the process.** Webcam frames live in memory only for the
  current inference and are discarded; only *derived signals* (a blink happened, your blink
  rate) are used. Nothing is recorded, shown, or sent.
- **Your data is local and yours.** Settings + daily stats live in a single plain-JSON file
  on your Mac. Reveal it, export it, or delete everything from **Settings → Privacy**.
- **No accounts, no cloud, no analytics, no telemetry.**

## Two ways to run

| Mode | What it does | Camera |
| --- | --- | --- |
| **Timer** (default) | Fires a gentle cue on a fixed interval | None |
| **Webcam** (opt-in) | Only nudges you when you actually stop blinking, using on-device MediaPipe face tracking | On-device only |

## Three ambient cues

- **Blur** — a soft frosted "breath" pulse (the research favourite; mimics dry-eye softening).
- **Dim** — the screen gently darkens and lifts.
- **Glow** — a soft glow breathes around the screen edges (colour customisable).

Pick your favourite during the 30-second first-run calibration, or in Settings.

## Getting started (development)

Requires **Node 22** (an `.nvmrc` is included).

```bash
nvm use              # Node 22
npm install
npm run assets       # one-time: copies MediaPipe WASM + downloads the face model into resources/
npm run dev          # launch the app
```

Blink runs in the **menu bar** (no Dock icon). On first launch it opens a short calibration
flow, then lives quietly in the menu bar (`◉`).

> **Note:** `npm run assets` is a build-time developer step (it fetches the local MediaPipe
> model once). The app itself never touches the network.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run the app with hot reload |
| `npm run assets` | Fetch local MediaPipe WASM + model into `resources/` |
| `npm test` | Run the unit tests (Vitest) |
| `npm run typecheck` | TypeScript type-check |
| `npm run build` | Production build to `out/` |

## Architecture

Electron + TypeScript, built with electron-vite; packaged (later) with electron-builder.

```
src/
├─ main/        # app lifecycle, tray, overlays, detection engine, permissions, storage
├─ preload/     # minimal context-isolated bridges (overlay · detector · settings)
├─ renderer/
│  ├─ overlay/  # full-screen click-through cue layers
│  ├─ detector/ # hidden window: getUserMedia + MediaPipe (opt-in)
│  └─ settings/ # onboarding flow + settings window
└─ shared/      # pure, unit-tested logic — no Electron imports
   ├─ cue-timing.ts   # fade envelope
   ├─ ear.ts          # Eye Aspect Ratio + blink detection
   ├─ bpm.ts          # rolling blinks-per-minute
   └─ trigger.ts      # no-blink / low-BPM thresholds + cooldown
```

The overlay is one transparent, click-through, always-on-top window **per display**. It
renders over normal apps and windowed video; note that a true native-full-screen macOS app
(on its own Space) may occlude it — a documented platform limitation.

## Status

Built and verified phase by phase:

- ✅ **Phase 1** — scaffold, tray, overlays, the three cues
- ✅ **Phase 2** — Timer mode + opt-in local webcam detection
- ✅ **Phase 3** — onboarding, settings, local persistence, privacy controls
- 🚧 **Phase 4** — tray icon states, pause options, native vibrancy blur, packaging

Platform focus is **macOS** for v1; the code is kept cross-platform-friendly for Windows/Linux later.

## License

MIT
