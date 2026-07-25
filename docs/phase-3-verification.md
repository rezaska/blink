# Phase 3 — Manual Verification Checklist

Phase 3 adds: the **first-run calibration onboarding**, the real **Settings window**
(replacing the temporary tray toggles), **local persistence** (electron-store), and the
**Privacy / data-sovereignty controls**.

## Run

```bash
nvm use
npm run dev
```

Because there's no completed setup yet, the **onboarding window opens automatically** on
first launch. (A `blink.json` with `onboarded:false` already exists from a smoke test, so
you'll go straight into onboarding.)

## A. Onboarding (first run)

- [ ] **Welcome** screen explains why blinking matters + the privacy note.
- [ ] **Step 1 · Detection** — Timer is offered first; choosing **Webcam** and continuing
      triggers the macOS **camera prompt**. Denying it drops you back to Timer with a note.
- [ ] **Step 2 · Try the cues** — the three cues (blur → dim → glow) auto-play while you
      read the sample text; "Play all three again" replays; clicking a cue previews it and
      selects it. "Let Blink decide" picks blur.
- [ ] **Step 3 · Sensitivity** — Relaxed / Standard / Attentive.
- [ ] **Step 4 · Done** — summary; **Start Blinking** closes the window and begins
      monitoring in your chosen mode.
- [ ] After finishing, the window closes and the Dock icon disappears (back to menu-bar only).

## B. Settings window

Open from the menu-bar **`◉` → Open Blink Settings…**

- [ ] **Cue type** (blur/dim/glow) with a working **Preview** button.
- [ ] **Intensity** slider — dragging then releasing previews the cue at that strength.
- [ ] **Glow colour** picker appears when cue = glow; **Stronger frost** toggle appears
      when cue = blur.
- [ ] **Detection** mode toggle (Timer/Webcam — switching to Webcam prompts/【uses camera).
- [ ] **Sensitivity** presets + **Advanced: exact seconds** override.
- [ ] **Timer interval** field (shown in Timer mode).
- [ ] **Launch at login** toggle (verify in System Settings → General → Login Items).
- [ ] **Re-run calibration…** reopens the onboarding flow.
- [ ] Every change **persists**: quit (menu → Quit) and relaunch — settings are retained.

## C. Privacy & data controls (data sovereignty)

- [ ] **Reveal data folder** opens Finder at the real `blink.json` location
      (`~/Library/Application Support/blink/`).
- [ ] **Export…** writes a JSON file (settings + stats) to the location you choose.
- [ ] **Delete all data** (click twice to confirm) wipes everything and returns the app to
      first-run — reopening Settings/onboarding shows defaults.
- [ ] **Today** stats card shows avg blinks/min, cues fired, and trend vs. yesterday.
      (In Webcam mode these populate as you use it; Timer mode has no blink rate, so
      avg BPM stays "—" while cues still count.)

## Notes
- **Stronger frost (macOS)** currently maps to a heavier CSS frosted pulse. The full
  native `NSVisualEffectView` vibrancy variant is slated for Phase 4 polish.
- Tray still shows a live status line; **pause options and icon states arrive in Phase 4**.

---

When A–C look good, we move to **Phase 4**: tray icon states, pause options
(30 min / 1 hr / until tomorrow), the native vibrancy blur variant, and packaging into a
`.dmg`.
