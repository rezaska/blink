/**
 * Pure cue-timing envelope logic. No Electron / DOM imports so it is unit-testable.
 *
 * A cue rises from 0 → 1 over `fadeInMs`, holds at 1 for `holdMs`, then falls
 * 1 → 0 over `fadeOutMs`. The research basis (CHI 2014 "Stimulating a Blink")
 * calls for slow fades (~1.5–2s in, brief hold, ~1.5–2s out) so cues register in
 * peripheral awareness without breaking concentration.
 */

export interface CueTiming {
  fadeInMs: number
  holdMs: number
  fadeOutMs: number
}

export const DEFAULT_TIMING: CueTiming = {
  fadeInMs: 1500,
  holdMs: 500,
  fadeOutMs: 1500
}

/** Total wall-clock duration of a cue in milliseconds. */
export function totalDurationMs(t: CueTiming): number {
  return t.fadeInMs + t.holdMs + t.fadeOutMs
}

/** Smooth ease-in-out (quadratic). Input and output are clamped to [0, 1]. */
export function easeInOut(x: number): number {
  const c = clamp01(x)
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2
}

function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

/**
 * Envelope intensity in [0, 1] at a given elapsed time (ms) since the cue started.
 * Returns 0 before the cue starts and after it completes.
 */
export function envelopeAt(elapsedMs: number, timing: CueTiming = DEFAULT_TIMING): number {
  const { fadeInMs, holdMs, fadeOutMs } = timing
  if (elapsedMs <= 0) return 0

  const holdEnd = fadeInMs + holdMs
  const total = holdEnd + fadeOutMs

  if (elapsedMs < fadeInMs) {
    return easeInOut(elapsedMs / fadeInMs)
  }
  if (elapsedMs < holdEnd) {
    return 1
  }
  if (elapsedMs < total) {
    const outElapsed = elapsedMs - holdEnd
    return easeInOut(1 - outElapsed / fadeOutMs)
  }
  return 0
}
