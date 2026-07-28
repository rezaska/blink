/**
 * Cue trigger logic: decides WHEN to fire a blink cue, with a cooldown debounce.
 * Pure logic, no timers here - the caller supplies "now" and the current metrics.
 *
 * Fires when EITHER the user hasn't blinked for `noBlinkMs` OR the rolling rate has
 * dropped below `minBpm` (only once the rate is reliable). After firing, a `cooldownMs`
 * window suppresses further cues so the nudges stay gentle rather than nagging.
 */

export interface TriggerConfig {
  /** Fire if there has been no blink for at least this long (ms). */
  noBlinkMs: number
  /** Fire if the reliable rolling rate is below this (blinks/min). */
  minBpm: number
  /** Minimum gap between cues (ms). */
  cooldownMs: number
}

export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  noBlinkMs: 8_000,
  minBpm: 7,
  cooldownMs: 20_000
}

export interface TriggerInput {
  now: number
  /** ms since the last blink, or null if none yet. */
  msSinceLastBlink: number | null
  /** current rolling blinks-per-minute. */
  bpm: number
  /** whether `bpm` is trustworthy yet (see BlinkRateTracker.isReliable). */
  bpmReliable: boolean
}

export type TriggerReason = 'no-blink' | 'low-bpm'

export class CueTrigger {
  private readonly cfg: TriggerConfig
  private lastCueAt: number | null = null

  constructor(config: Partial<TriggerConfig> = {}) {
    this.cfg = { ...DEFAULT_TRIGGER_CONFIG, ...config }
  }

  private inCooldown(now: number): boolean {
    return this.lastCueAt !== null && now - this.lastCueAt < this.cfg.cooldownMs
  }

  /** Returns the reason a cue should fire now, or null if it should not. */
  evaluate(input: TriggerInput): TriggerReason | null {
    if (this.inCooldown(input.now)) return null
    if (input.msSinceLastBlink !== null && input.msSinceLastBlink >= this.cfg.noBlinkMs) {
      return 'no-blink'
    }
    if (input.bpmReliable && input.bpm < this.cfg.minBpm) {
      return 'low-bpm'
    }
    return null
  }

  shouldFire(input: TriggerInput): boolean {
    return this.evaluate(input) !== null
  }

  markFired(now: number): void {
    this.lastCueAt = now
  }

  reset(): void {
    this.lastCueAt = null
  }
}
