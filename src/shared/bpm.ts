/**
 * Rolling blinks-per-minute tracker over a sliding time window. Pure logic.
 *
 * Records blink timestamps and, for a given "now", reports how many fall within the
 * trailing window and the equivalent per-minute rate. Also reports time since the last
 * blink (used by the "no blink for N seconds" trigger) and whether enough time has
 * elapsed for the rate to be trustworthy (warm-up guard against false low-rate triggers).
 */

export class BlinkRateTracker {
  private readonly windowMs: number
  private times: number[] = []
  /** When tracking began, so we know whether the window has "filled". */
  private startedAt: number | null = null

  constructor(windowMs = 60_000) {
    this.windowMs = windowMs
  }

  /** Call once when monitoring (re)starts, so warm-up is measured from here. */
  start(now: number): void {
    this.startedAt = now
    this.times = []
  }

  addBlink(timestampMs: number): void {
    if (this.startedAt === null) this.startedAt = timestampMs
    this.times.push(timestampMs)
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs
    let i = 0
    while (i < this.times.length && this.times[i] < cutoff) i++
    if (i > 0) this.times = this.times.slice(i)
  }

  /** Number of blinks within the trailing window ending at `now`. */
  countInWindow(now: number): number {
    this.prune(now)
    return this.times.length
  }

  /** Blinks per minute over the window. */
  rate(now: number): number {
    const count = this.countInWindow(now)
    return count * (60_000 / this.windowMs)
  }

  /** Milliseconds since the most recent blink, or null if none recorded yet. */
  msSinceLastBlink(now: number): number | null {
    if (this.times.length === 0) return null
    return now - this.times[this.times.length - 1]
  }

  /**
   * Whether the rate is trustworthy yet: we've been tracking for at least the full
   * window (or `minObserveMs` if you want to react sooner). Prevents a spurious
   * "low BPM" trigger in the first seconds after monitoring starts.
   */
  isReliable(now: number, minObserveMs = this.windowMs): boolean {
    return this.startedAt !== null && now - this.startedAt >= minObserveMs
  }

  reset(): void {
    this.times = []
    this.startedAt = null
  }
}
