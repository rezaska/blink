import { envelopeAt, totalDurationMs, DEFAULT_TIMING } from '../../shared/cue-timing'
import type { CuePayload, CueType } from '../../shared/types'

const layers: Record<CueType, HTMLElement> = {
  blur: document.getElementById('blur')!,
  dim: document.getElementById('dim')!,
  glow: document.getElementById('glow')!
}

let rafId = 0

function resetAll(): void {
  cancelAnimationFrame(rafId)
  for (const el of Object.values(layers)) el.style.opacity = '0'
}

function fire(payload: CuePayload): void {
  resetAll()

  const el = layers[payload.type]
  if (!el) return

  if (payload.type === 'glow' && payload.color) {
    el.style.setProperty('--glow-color', payload.color)
  }
  if (payload.type === 'blur') {
    el.classList.toggle('strong', payload.strongFrost === true)
  }

  const timing = payload.timing ?? DEFAULT_TIMING
  const total = totalDurationMs(timing)
  const peak = Math.max(0, Math.min(1, payload.intensity ?? 1))
  const start = performance.now()

  const step = (now: number): void => {
    const elapsed = now - start
    el.style.opacity = String(envelopeAt(elapsed, timing) * peak)
    if (elapsed < total) {
      rafId = requestAnimationFrame(step)
    } else {
      el.style.opacity = '0'
    }
  }

  rafId = requestAnimationFrame(step)
}

window.blink.onCue(fire)
