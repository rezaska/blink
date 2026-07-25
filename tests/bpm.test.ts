import { describe, it, expect } from 'vitest'
import { BlinkRateTracker } from '../src/shared/bpm'

describe('BlinkRateTracker', () => {
  it('counts blinks within the trailing window and drops old ones', () => {
    const t = new BlinkRateTracker(60_000)
    t.start(0)
    t.addBlink(1_000)
    t.addBlink(30_000)
    t.addBlink(59_000)
    expect(t.countInWindow(60_000)).toBe(3)
    // at t=65s, the 1s blink (age 64s) has aged out of the 60s window
    expect(t.countInWindow(65_000)).toBe(2)
  })

  it('reports blinks/min scaled from the window size', () => {
    const t = new BlinkRateTracker(60_000)
    t.start(0)
    for (let i = 1; i <= 15; i++) t.addBlink(i * 1_000)
    expect(t.rate(60_000)).toBe(15) // 15 blinks in 60s => 15 bpm
  })

  it('scales rate correctly for a non-60s window', () => {
    const t = new BlinkRateTracker(30_000) // 30s window
    t.start(0)
    t.addBlink(10_000)
    t.addBlink(20_000)
    expect(t.rate(30_000)).toBe(4) // 2 blinks in 30s => 4 per minute
  })

  it('tracks ms since last blink', () => {
    const t = new BlinkRateTracker()
    expect(t.msSinceLastBlink(5_000)).toBeNull()
    t.addBlink(2_000)
    expect(t.msSinceLastBlink(5_000)).toBe(3_000)
  })

  it('is unreliable until the observation window has elapsed', () => {
    const t = new BlinkRateTracker(60_000)
    t.start(1_000)
    expect(t.isReliable(30_000)).toBe(false) // only 29s observed
    expect(t.isReliable(61_000)).toBe(true) // 60s observed
  })

  it('reset clears state', () => {
    const t = new BlinkRateTracker()
    t.addBlink(1_000)
    t.reset()
    expect(t.countInWindow(2_000)).toBe(0)
    expect(t.msSinceLastBlink(2_000)).toBeNull()
  })
})
