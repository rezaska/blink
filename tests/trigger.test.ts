import { describe, it, expect } from 'vitest'
import { CueTrigger } from '../src/shared/trigger'

const cfg = { noBlinkMs: 8_000, minBpm: 7, cooldownMs: 20_000 }

const base = { now: 0, msSinceLastBlink: 0, bpm: 15, bpmReliable: true }

describe('CueTrigger', () => {
  it('does not fire when blinking normally', () => {
    const t = new CueTrigger(cfg)
    expect(t.shouldFire({ ...base, now: 1_000, msSinceLastBlink: 2_000, bpm: 15 })).toBe(false)
  })

  it('fires on the no-blink threshold', () => {
    const t = new CueTrigger(cfg)
    expect(t.evaluate({ ...base, now: 10_000, msSinceLastBlink: 8_000, bpm: 15 })).toBe('no-blink')
  })

  it('fires on low BPM when reliable', () => {
    const t = new CueTrigger(cfg)
    expect(
      t.evaluate({ now: 70_000, msSinceLastBlink: 1_000, bpm: 5, bpmReliable: true })
    ).toBe('low-bpm')
  })

  it('does NOT fire on low BPM while still warming up (unreliable)', () => {
    const t = new CueTrigger(cfg)
    expect(t.shouldFire({ now: 5_000, msSinceLastBlink: 1_000, bpm: 2, bpmReliable: false })).toBe(
      false
    )
  })

  it('suppresses cues during the cooldown, then allows again', () => {
    const t = new CueTrigger(cfg)
    // first cue fires
    expect(t.shouldFire({ ...base, now: 10_000, msSinceLastBlink: 9_000 })).toBe(true)
    t.markFired(10_000)
    // within cooldown: suppressed even though condition still true
    expect(t.shouldFire({ ...base, now: 25_000, msSinceLastBlink: 9_000 })).toBe(false)
    // after cooldown (>= 20s later): allowed again
    expect(t.shouldFire({ ...base, now: 30_001, msSinceLastBlink: 9_000 })).toBe(true)
  })

  it('does not fire from a null last-blink alone while warming up', () => {
    // No blink recorded yet AND rate not reliable => stay quiet (avoids startup false-fire).
    const t = new CueTrigger(cfg)
    expect(
      t.shouldFire({ now: 3_000, msSinceLastBlink: null, bpm: 0, bpmReliable: false })
    ).toBe(false)
  })

  it('fires via low-bpm once reliable even with zero blinks recorded (null)', () => {
    // 60s elapsed with no blinks at all is the worst case — nudge the user.
    const t = new CueTrigger(cfg)
    expect(
      t.evaluate({ now: 100_000, msSinceLastBlink: null, bpm: 0, bpmReliable: true })
    ).toBe('low-bpm')
  })

  it('reset clears the cooldown', () => {
    const t = new CueTrigger(cfg)
    t.markFired(10_000)
    t.reset()
    expect(t.shouldFire({ ...base, now: 11_000, msSinceLastBlink: 9_000 })).toBe(true)
  })
})
