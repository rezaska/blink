# Phase 4 — Manual Verification Checklist

Phase 4 (excluding packaging, which is intentionally deferred) adds: **tray icon states**,
**pause options**, and the **native macOS "real frost" vibrancy blur**.

## Run

```bash
nvm use
npm run dev
```

## A. Tray icon states

The menu-bar glyph reflects engine state:

- [ ] **Monitoring** → `◉` (Timer running, or Webcam watching).
- [ ] **Blink flash** → each time a cue fires, the glyph briefly flips to `–` and back.
      (Easiest to see in Timer mode with a short interval, or by staring in Webcam mode.)
- [ ] **Paused** → `◌` (see section B).
- [ ] **No camera** → `⊘` (switch to Webcam and *deny* the permission, or have the camera
      busy in another app).

> Note: these are crisp monochrome menu-bar glyphs standing in for bespoke eye artwork;
> the code has a single seam (`setTrayState`) where real template PNGs can drop in later.

## B. Pause options

- [ ] Tray → **Pause** → **For 30 minutes / For 1 hour / Until tomorrow**.
- [ ] While paused: the status line reads **"Paused · resumes <time>"**, the icon shows `◌`,
      the camera (if it was on) turns **off**, and **no cues fire**.
- [ ] The menu now shows **Resume (paused until <time>)** — clicking it resumes immediately
      and restarts your chosen mode.
- [ ] A short pause **auto-resumes** on its own when the timer elapses.

## C. Native "real frost" blur (macOS)

- [ ] Settings → cue type **Blur** → enable **Real frost (macOS)**.
- [ ] **Preview** (or wait for a real reminder): the screen behind the cue is genuinely
      blurred by a macOS vibrancy material that **fades in and out** — not just a white veil.
- [ ] Turning **Real frost off** returns to the lightweight CSS frosted pulse.

> This is a *crossfade* of a real frosted overlay. macOS vibrancy has a fixed blur radius
> that can't be animated, so the frost fades in/out rather than the blur amount pulsing —
> a documented platform constraint.

## Not in this phase (deferred)
- **`.dmg` packaging** — held until you're ready to package/sign/notarize.
- Launch-at-login registers only in a packaged/signed build; it's intentionally skipped in
  the unsigned dev binary (which can't set a login item).

---

Once A–C look good, the remaining step whenever you're ready is **packaging**: an
electron-builder `.dmg` with `asarUnpack` for the WASM/model, the camera usage string, and
entitlements.
