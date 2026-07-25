# Phase 2 — Manual Verification Checklist

Phase 2 adds: **Timer mode (the default)** + an **opt-in webcam blink-detection engine**
(MediaPipe Face Landmarker, 100% local), rolling blinks-per-minute tracking, and the
no-blink / low-BPM trigger with cooldown. All pure logic is unit-tested.

## Prerequisites

```bash
nvm use                      # Node 22 (or export the PATH prefix)
npm run assets               # one-time: copies WASM + downloads face_landmarker.task
```

`npm run assets` populates `resources/wasm/` and `resources/models/face_landmarker.task`.
These are git-ignored; the download is a **build-time developer step** — the app itself
never hits the network.

## Automated checks (already green)

```bash
npm run typecheck   # ✓
npm test            # ✓ 36 tests (cue-timing, ear, bpm, trigger)
npm run build       # ✓ main + preload(overlay,detector) + renderer(overlay,detector)
```

## Run

```bash
npm run dev
```

Menu bar → **`◉`**. The menu now has a **status line**, **Detection** (Timer / Webcam),
**Timer interval**, **Cue on reminder**, and the Phase-1 **Fire test cue**.
*(These tray toggles are temporary — Settings + onboarding replace them in Phase 3.)*

## A. Timer mode (default — no camera)

- [ ] On launch, status reads **"Timer mode · every 60s"** and **no camera prompt** appears.
- [ ] Set **Timer interval → 10s**. Within ~10s a cue fires (it uses the **Cue on
      reminder** type — set it to **Dim** or **Glow** to see it clearly).
- [ ] **Cue on reminder → Glow/Dim/Blur** changes which cue the timer fires.
- [ ] No `[detector]` logs appear and no camera indicator light turns on (camera is
      never touched in Timer mode).

## B. Webcam mode (opt-in)

- [ ] Switch **Detection → Webcam (opt-in)**. A macOS **camera permission prompt**
      appears (first time only). The terminal shows `[detector]` logs.
- [ ] **Allow** it → your camera light turns on, status becomes
      **"Webcam · watching your blinks"**.
- [ ] **Stop blinking / stare** at the screen for ~8s → a cue fires. Blink normally and
      it stays quiet. After a cue there's a ~20s cooldown before another can fire.
- [ ] **Look away / cover the camera** for ~1.5s → status becomes
      **"Webcam · paused (no face)"**; cues stop. Return → back to "watching".
- [ ] Switch back to **Timer** → camera light turns **off** (detector window destroyed).

### If you instead DENY the permission
- [ ] Status shows **"Camera denied · using timer"** and Timer mode keeps working — the
      app degrades gracefully, never gets stuck.

## C. Data sovereignty / performance

- [ ] **Zero network:** run a network monitor (Little Snitch / `nettop -p <pid>`) while
      in **both** modes → no outbound connections. (The WASM + model load from `app://`
      on disk; the guard blocks everything else.)
- [ ] **CPU:** in Activity Monitor, the webcam detector should sit well under ~5% on a
      typical laptop (frames are throttled to ~10 fps at 320×240).
- [ ] **No frames leave the process:** only blink/status signals cross IPC (by design —
      see `src/preload/detector.ts`; it can only send "a blink happened" or a status).

## Troubleshooting
The terminal pipes detector logs prefixed `[detector]`. If webcam mode shows
**"Detector error · using timer"**, copy those lines — they'll show whether it was the
WASM load, the model, or the camera.

---

When A–C look good, we move to **Phase 3**: the calibration onboarding flow, the real
Settings window (replacing these tray toggles), and local persistence.
