# Blink

**Gentle reminders to blink, so your eyes don't dry out while you work.**

When you stare at a screen, you blink far less than normal. A healthy rate is about 15 to 20
times a minute, but while focusing it can drop to just 4 or 5, which leaves your eyes dry,
tired, and sore. Blink watches how often you blink and gives you a soft nudge on screen when
it's been too long. No pop-ups. The design follows research (the 2014 "Stimulating a Blink"
study from UC Davis): gentle on-screen cues get people to blink more, a soft screen blur
works best, and pop-ups are the worst because people just turn them off. The cues fade in and
out slowly, so you notice them out of the corner of your eye without being pulled away from
what you're doing.

Blink is private by design, and you can check that for yourself:

- **It never connects to the internet.** Blink blocks every network request except loading
  its own local files. You can confirm it with a tool like Little Snitch or `nettop`:
  nothing goes out.
- **The webcam is optional and off by default.** Blink works fine on a simple timer with no
  camera. You only turn the camera on if you want to.
- **Camera video never gets saved or sent.** In webcam mode, each frame is checked in memory
  and thrown away right after. Nothing is recorded, shown, or sent anywhere. Only simple
  facts are used, like "a blink just happened".
- **Your settings and stats stay on your Mac.** They live in one plain text file. You can
  open its folder, export it, or delete everything from Settings.
- **No account, no cloud, no tracking.**

## How it works

Blink can run in two ways:

| Mode | What it does | Camera |
| --- | --- | --- |
| **Timer** (default) | Reminds you on a set schedule | Not used |
| **Webcam** (optional) | Only reminds you when you actually stop blinking, using on-device face tracking | On-device only |

And it can remind you in three ways. You pick your favorite during the quick first-time
setup, or later in Settings:

- **Blur**: a soft, frosted pulse (the one the research liked best).
- **Dim**: the screen gently darkens, then comes back.
- **Glow**: a soft glow breathes around the edges of the screen (you can pick the color).

## Under the hood

A menu-bar desktop app built with **Electron**, **TypeScript**, and **electron-vite**, with
on-device face tracking from **MediaPipe** and unit tests in **Vitest**.

Some of the more interesting parts of the code:

- **Privacy is enforced in code, not just promised.** The main process installs a
  network kill-switch that cancels every outbound request except local files, so the "no
  internet" claim is something you can actually verify. Camera frames never leave the hidden
  detector window; only small facts (a blink happened, the current blink rate) are passed to
  the rest of the app.
- **On-device blink detection.** A hidden window runs MediaPipe's Face Landmarker at about
  10 frames per second and reads the eye-blink signals. The model and its WebAssembly files
  are bundled with the app and served from a custom local `app://` protocol, so nothing is
  ever downloaded at runtime.
- **Works with no camera.** Timer mode is the default and needs no permission. Webcam mode
  falls back to the timer automatically if the camera is denied or busy, and pauses itself
  when it can't see a face.
- **Ambient overlays.** The cues render in a transparent, click-through, always-on-top
  window, one per display, with a smooth fade in, short hold, and fade out.
- **A real macOS frost option.** An optional blur that uses a genuine macOS vibrancy layer
  (NSVisualEffectView) to blur the desktop behind the cue, crossfaded in and out.
- **The tricky logic is pure and tested.** The blink math (eye aspect ratio, blinks per
  minute, and the rules for when to remind you) lives in plain TypeScript with no Electron
  code, covered by unit tests.

### Project layout

```
src/
├─ main/        app startup, menu bar, overlays, detection, permissions, storage
├─ preload/     small safe bridges between the app and each window
├─ renderer/
│  ├─ overlay/  the full-screen reminder layers
│  ├─ detector/ hidden window that reads the webcam (only when turned on)
│  └─ settings/ first-time setup and the settings window
└─ shared/      plain, tested logic with no Electron code
   ├─ cue-timing.ts   the fade in and fade out timing
   ├─ ear.ts          measuring the eyes and spotting blinks
   ├─ bpm.ts          blinks per minute
   └─ trigger.ts      when to show a reminder
```

One thing worth knowing about the overlay: it sits on top of normal apps and video, but a
true full-screen Mac app (on its own Space) can cover it up. That is a limit of macOS.

Blink is built for macOS first. The code is kept tidy so Windows and Linux can come later.
