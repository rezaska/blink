import { describe, it, expect } from 'vitest'
import {
  distance,
  eyeAspectRatio,
  BlinkDetector,
  type Point
} from '../src/shared/ear'

describe('distance', () => {
  it('computes Euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

// A synthetic eye: width 1.0, adjustable lid gap `h`.
function eye(h: number): [Point, Point, Point, Point, Point, Point] {
  return [
    { x: 0, y: 0 }, // p1 outer corner
    { x: 0.3, y: h / 2 }, // p2 upper-outer
    { x: 0.7, y: h / 2 }, // p3 upper-inner
    { x: 1, y: 0 }, // p4 inner corner
    { x: 0.7, y: -h / 2 }, // p5 lower-inner
    { x: 0.3, y: -h / 2 } // p6 lower-outer
  ]
}

describe('eyeAspectRatio', () => {
  it('is larger for a more-open eye', () => {
    expect(eyeAspectRatio(eye(0.6))).toBeGreaterThan(eyeAspectRatio(eye(0.1)))
  })

  it('equals lid-gap for this unit-width synthetic eye', () => {
    // both vertical distances = h, horizontal = 1 => (h + h) / (2*1) = h
    expect(eyeAspectRatio(eye(0.3))).toBeCloseTo(0.3, 6)
  })

  it('returns 0 when the eye has zero width (degenerate)', () => {
    const degenerate = eye(0.3).map((p) => ({ ...p, x: 0 })) as ReturnType<typeof eye>
    expect(eyeAspectRatio(degenerate)).toBe(0)
  })
})

describe('BlinkDetector', () => {
  const opts = { closeThreshold: 0.2, openThreshold: 0.25, minClosedMs: 30, maxClosedMs: 500 }

  it('detects a normal blink on reopen', () => {
    const d = new BlinkDetector(opts)
    expect(d.update(0.3, 0)).toBe(false) // open
    expect(d.update(0.15, 100)).toBe(false) // closing
    expect(d.update(0.15, 200)).toBe(false) // still closed
    expect(d.update(0.3, 250)).toBe(true) // reopen -> blink (closed 150ms)
  })

  it('fires once per blink, not per closed frame', () => {
    const d = new BlinkDetector(opts)
    d.update(0.3, 0)
    let fires = 0
    for (const [ear, t] of [
      [0.1, 50],
      [0.1, 100],
      [0.1, 150],
      [0.3, 200]
    ] as const) {
      if (d.update(ear, t)) fires++
    }
    expect(fires).toBe(1)
  })

  it('ignores dips shorter than minClosedMs (noise)', () => {
    const d = new BlinkDetector(opts)
    d.update(0.3, 0)
    d.update(0.1, 100)
    expect(d.update(0.3, 110)).toBe(false) // only 10ms closed < 30ms
  })

  it('ignores closures longer than maxClosedMs (eyes shut / away)', () => {
    const d = new BlinkDetector(opts)
    d.update(0.3, 0)
    d.update(0.1, 100)
    expect(d.update(0.3, 900)).toBe(false) // 800ms closed > 500ms
  })

  it('uses hysteresis: does not reopen between the two thresholds', () => {
    const d = new BlinkDetector(opts)
    d.update(0.3, 0)
    d.update(0.1, 100) // closed
    expect(d.update(0.22, 200)).toBe(false) // between close(0.2) and open(0.25): still closed
    expect(d.isClosed()).toBe(true)
    expect(d.update(0.3, 250)).toBe(true) // now reopens
  })

  it('reset clears closed state', () => {
    const d = new BlinkDetector(opts)
    d.update(0.1, 0)
    expect(d.isClosed()).toBe(true)
    d.reset()
    expect(d.isClosed()).toBe(false)
  })
})
