/**
 * Eye Aspect Ratio (EAR) + blink-event detection. Pure logic, no DOM/Electron imports.
 *
 * EAR (Soukupová & Čech 2016) is the ratio of eye height to eye width. It is ~0.3 for
 * an open eye and drops toward ~0.1 when closed, so a blink is a brief dip and recovery.
 * A hysteresis state machine (separate close/open thresholds) turns a noisy EAR stream
 * into discrete blink events, ignoring dips that last too long (eyes simply shut / away).
 */

export interface Point {
  x: number
  y: number
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * EAR from the six canonical eye points, ordered:
 * p1 = outer corner, p2 = upper-outer lid, p3 = upper-inner lid,
 * p4 = inner corner, p5 = lower-inner lid, p6 = lower-outer lid.
 */
export function eyeAspectRatio(pts: readonly [Point, Point, Point, Point, Point, Point]): number {
  const [p1, p2, p3, p4, p5, p6] = pts
  const horizontal = distance(p1, p4)
  if (horizontal === 0) return 0
  return (distance(p2, p6) + distance(p3, p5)) / (2 * horizontal)
}

/**
 * MediaPipe Face Landmarker (468/478-point mesh) indices for the six EAR points of
 * each eye, in the order expected by `eyeAspectRatio`.
 */
export const LEFT_EYE_EAR_INDICES = [33, 160, 158, 133, 153, 144] as const
export const RIGHT_EYE_EAR_INDICES = [362, 385, 387, 263, 373, 380] as const

/** Build the six-point tuple for one eye from a full landmark array. */
export function earPointsFromLandmarks(
  landmarks: readonly Point[],
  indices: readonly [number, number, number, number, number, number]
): [Point, Point, Point, Point, Point, Point] {
  return indices.map((i) => landmarks[i]) as [Point, Point, Point, Point, Point, Point]
}

/** Average EAR across both eyes from a full MediaPipe landmark array. */
export function averageEar(landmarks: readonly Point[]): number {
  const left = eyeAspectRatio(earPointsFromLandmarks(landmarks, LEFT_EYE_EAR_INDICES))
  const right = eyeAspectRatio(earPointsFromLandmarks(landmarks, RIGHT_EYE_EAR_INDICES))
  return (left + right) / 2
}

export interface BlinkDetectorOptions {
  /** Openness below this = eye is closing. */
  closeThreshold: number
  /** Openness above this = eye is open again (hysteresis; should be > closeThreshold). */
  openThreshold: number
  /** Dips shorter than this are treated as noise, not blinks. */
  minClosedMs: number
  /** Closures longer than this are "eyes shut / away", not a blink. */
  maxClosedMs: number
}

export const DEFAULT_BLINK_OPTIONS: BlinkDetectorOptions = {
  closeThreshold: 0.2,
  openThreshold: 0.25,
  minClosedMs: 30,
  maxClosedMs: 500
}

/**
 * Stateful blink detector driven by an "openness" signal (EAR, or `1 - blendshapeBlink`).
 * Feed successive samples via `update`; it returns `true` on the sample that COMPLETES a
 * blink (the eye reopening after a valid-length closure).
 */
export class BlinkDetector {
  private readonly opts: BlinkDetectorOptions
  private closed = false
  private closedAt = 0

  constructor(options: Partial<BlinkDetectorOptions> = {}) {
    this.opts = { ...DEFAULT_BLINK_OPTIONS, ...options }
  }

  /** @returns true iff this sample completes a valid blink. */
  update(openness: number, timestampMs: number): boolean {
    if (!this.closed) {
      if (openness < this.opts.closeThreshold) {
        this.closed = true
        this.closedAt = timestampMs
      }
      return false
    }
    // currently closed — wait for reopen past the (higher) open threshold.
    if (openness > this.opts.openThreshold) {
      const closedMs = timestampMs - this.closedAt
      this.closed = false
      return closedMs >= this.opts.minClosedMs && closedMs <= this.opts.maxClosedMs
    }
    return false
  }

  /** True while the eye is currently in the closed state. */
  isClosed(): boolean {
    return this.closed
  }

  reset(): void {
    this.closed = false
    this.closedAt = 0
  }
}
