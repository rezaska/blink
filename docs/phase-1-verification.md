# Phase 1 — Manual Verification Checklist

Phase 1 delivers: Electron scaffold + menu-bar (tray) app + per-display transparent
click-through overlay windows + the three ambient cues (blur / dim / glow) on a
manual trigger. No webcam, no persistence yet.

## Prerequisites

This machine's default `node` is an EOL v12; use Node 22 via nvm:

```bash
nvm use            # reads .nvmrc → 22
# or, if a shell hasn't loaded nvm:
export PATH="$HOME/.nvm/versions/node/v22.11.0/bin:$PATH"
```

## Automated checks (already green)

```bash
npm run typecheck   # ✓ no type errors
npm test            # ✓ 12/12 cue-timing tests
npm run build       # ✓ main + preload + renderer build
```

## Run the app

```bash
npm run dev
```

The app has **no Dock icon** — look in the **menu bar** (top-right) for a `◉` glyph.

> **Note:** this machine has `ELECTRON_RUN_AS_NODE=1` exported globally, which makes
> *any* Electron app boot as plain Node (no windows, no tray). The `dev`/`preview`
> scripts `unset` it so Blink always launches correctly. If you want other Electron
> apps to work too, consider removing that variable from your shell profile.

## Verify (the things I can't check headlessly)

Open the menu-bar item → **Fire test cue** → try each of **Blur**, **Dim**, **Glow**:

- [ ] **a. Renders on top** — with a normal maximized window (e.g. a browser) and with
      *windowed* video playing, the cue appears over it. *(Note: a true native
      full-screen app on its own Space may occlude it — a documented macOS limitation.)*
- [ ] **b. Click-through** — while a cue is visible, click and type into the app
      underneath; input passes straight through, the overlay never intercepts it.
- [ ] **c. No focus theft** — firing a cue does not steal focus / does not raise a
      window in front of your active app.
- [ ] **d. Fade timing feels right** — ~1.5s fade in, brief hold, ~1.5s fade out;
      smooth, gentle, non-jarring.
- [ ] **e. Multi-monitor** — if you have more than one display, the cue shows on
      **each** display. Unplug/replug a display and confirm cues still fire.

### Notes on the cues (tunable in later phases)
- **Blur** is an approximated frosted "breath" veil, not a true blur of the pixels
  behind it (impossible from a transparent overlay — see the plan). Phase 3 adds an
  optional macOS vibrancy "real frost" variant and an intensity slider.
- **Dim** fades a black veil to ~24% opacity. **Glow** is a soft teal inset edge glow.
- Intensity / color / exact timing become adjustable in Phase 3 settings.

## To quit
Menu-bar item → **Quit**.

---

When (a)–(e) look good, we move to **Phase 2**: default Timer mode + the opt-in,
fully-local webcam blink-detection engine.
