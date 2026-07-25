import { describe, it, expect } from 'vitest'
import {
  envelopeAt,
  easeInOut,
  totalDurationMs,
  DEFAULT_TIMING,
  type CueTiming
} from '../src/shared/cue-timing'

const T: CueTiming = { fadeInMs: 1000, holdMs: 400, fadeOutMs: 1000 }

describe('totalDurationMs', () => {
  it('sums the three phases', () => {
    expect(totalDurationMs(T)).toBe(2400)
    expect(totalDurationMs(DEFAULT_TIMING)).toBe(3500)
  })
})

describe('easeInOut', () => {
  it('anchors at 0, 0.5, 1', () => {
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 5)
    expect(easeInOut(1)).toBe(1)
  })

  it('clamps out-of-range input', () => {
    expect(easeInOut(-2)).toBe(0)
    expect(easeInOut(5)).toBe(1)
  })

  it('is symmetric about the midpoint', () => {
    expect(easeInOut(0.25)).toBeCloseTo(1 - easeInOut(0.75), 5)
  })
})

describe('envelopeAt', () => {
  it('is 0 at and before the start', () => {
    expect(envelopeAt(0, T)).toBe(0)
    expect(envelopeAt(-100, T)).toBe(0)
  })

  it('peaks at 1 exactly when fade-in ends', () => {
    expect(envelopeAt(T.fadeInMs, T)).toBe(1)
  })

  it('holds at 1 through the hold phase', () => {
    expect(envelopeAt(T.fadeInMs + 1, T)).toBe(1)
    expect(envelopeAt(T.fadeInMs + T.holdMs - 1, T)).toBe(1)
  })

  it('returns to 0 at and after total duration', () => {
    const total = totalDurationMs(T)
    expect(envelopeAt(total, T)).toBe(0)
    expect(envelopeAt(total + 500, T)).toBe(0)
  })

  it('rises monotonically during fade-in', () => {
    let prev = -1
    for (let t = 0; t <= T.fadeInMs; t += 50) {
      const v = envelopeAt(t, T)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('falls monotonically during fade-out', () => {
    const start = T.fadeInMs + T.holdMs
    let prev = 2
    for (let t = start; t <= totalDurationMs(T); t += 50) {
      const v = envelopeAt(t, T)
      expect(v).toBeLessThanOrEqual(prev)
      prev = v
    }
  })

  it('stays within [0, 1] across the whole envelope', () => {
    for (let t = -100; t <= totalDurationMs(T) + 100; t += 25) {
      const v = envelopeAt(t, T)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('uses DEFAULT_TIMING when none supplied', () => {
    expect(envelopeAt(DEFAULT_TIMING.fadeInMs)).toBe(1)
  })
})
