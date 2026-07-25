import { ipcMain } from 'electron'
import { BlinkRateTracker } from '../shared/bpm'
import { CueTrigger } from '../shared/trigger'
import {
  IPC,
  SENSITIVITY_MS,
  type CuePayload,
  type DetectionMode,
  type DetectorStatus
} from '../shared/types'
import { fireCue } from './cue-controller'
import { ensureCameraAccess } from './permissions'
import { createDetectorWindow, destroyDetectorWindow } from './detector-window'
import {
  getSettings,
  recordBlink,
  recordCue,
  recordBpmSample,
  applyLaunchAtLogin
} from './store'

/**
 * The detection engine, driven by persisted settings. Timer mode (default) fires a cue
 * on a fixed interval with no camera. Webcam mode (opt-in) consumes derived blink
 * signals from the hidden detector, tracks blinks/min, and fires via the trigger logic,
 * transparently falling back to the timer if the camera is unavailable.
 */

const WINDOW_MS = 60_000
const BPM_SAMPLE_EVERY_TICKS = 10 // ~ every 10s

let mode: DetectionMode = 'timer'
let timerIntervalMs = 60_000
let appliedNoBlinkMs: number = SENSITIVITY_MS.standard

const tracker = new BlinkRateTracker(WINDOW_MS)
let trigger = new CueTrigger({ noBlinkMs: appliedNoBlinkMs })

let detectorStatus: DetectorStatus = { state: 'loading' }
let webcamFallback: string | null = null
let tickCount = 0

let timerHandle: ReturnType<typeof setInterval> | null = null
let tickHandle: ReturnType<typeof setInterval> | null = null
let onChange: (() => void) | null = null

function notify(): void {
  onChange?.()
}

function cuePayload(): CuePayload {
  const s = getSettings()
  return {
    type: s.cueType,
    intensity: s.intensity,
    color: s.cueType === 'glow' ? s.glowColor : undefined,
    strongFrost: s.cueType === 'blur' ? s.macVibrancyBlur : undefined
  }
}

function fire(): void {
  fireCue(cuePayload())
  trigger.markFired(Date.now())
  recordCue()
}

function clearTimers(): void {
  if (timerHandle) clearInterval(timerHandle)
  if (tickHandle) clearInterval(tickHandle)
  timerHandle = null
  tickHandle = null
}

function startTimerLoop(): void {
  clearTimers()
  timerHandle = setInterval(fire, timerIntervalMs)
}

function startWebcamTick(): void {
  clearTimers()
  tracker.start(Date.now())
  trigger.reset()
  tickCount = 0
  tickHandle = setInterval(() => {
    if (webcamFallback) return
    if (detectorStatus.state !== 'running') return // paused while loading / away
    const now = Date.now()
    const bpm = tracker.rate(now)
    const reliable = tracker.isReliable(now)
    if (reliable && ++tickCount % BPM_SAMPLE_EVERY_TICKS === 0) recordBpmSample(bpm)
    if (
      trigger.shouldFire({ now, msSinceLastBlink: tracker.msSinceLastBlink(now), bpm, bpmReliable: reliable })
    ) {
      fire()
    }
  }, 1000)
}

function onStatus(status: DetectorStatus): void {
  const prev = detectorStatus.state
  detectorStatus = status
  if (status.state === 'no-permission' || status.state === 'camera-in-use' || status.state === 'error') {
    webcamFallback = status.state
    destroyDetectorWindow()
    startTimerLoop()
  } else if (status.state === 'running' && prev === 'no-face') {
    // Returned from away — restart the window so we don't instantly fire "no blink".
    tracker.start(Date.now())
    trigger.reset()
  }
  notify()
}

async function switchMode(next: DetectionMode): Promise<void> {
  clearTimers()
  destroyDetectorWindow()
  webcamFallback = null
  mode = next

  if (next === 'timer') {
    startTimerLoop()
    notify()
    return
  }
  const access = await ensureCameraAccess()
  if (access === 'denied') {
    webcamFallback = 'no-permission'
    detectorStatus = { state: 'no-permission' }
    startTimerLoop()
    notify()
    return
  }
  detectorStatus = { state: 'loading' }
  createDetectorWindow()
  startWebcamTick()
  notify()
}

/** Register IPC listeners once, at startup. */
export function initDetection(onStatusChange: () => void): void {
  onChange = onStatusChange
  ipcMain.on(IPC.detectorBlink, () => {
    if (mode === 'webcam' && !webcamFallback) {
      tracker.addBlink(Date.now())
      recordBlink()
    }
  })
  ipcMain.on(IPC.detectorStatus, (_e, status: DetectorStatus) => onStatus(status))
}

/**
 * Reconcile the engine with the persisted settings. Only restarts the camera when the
 * mode actually changes; intensity/cue/interval/sensitivity tweaks apply in place.
 */
export async function applySettings(): Promise<void> {
  const s = getSettings()
  applyLaunchAtLogin()
  timerIntervalMs = s.timerIntervalMs

  const noBlink = s.advancedNoBlinkMs ?? SENSITIVITY_MS[s.sensitivity]
  if (noBlink !== appliedNoBlinkMs) {
    appliedNoBlinkMs = noBlink
    trigger = new CueTrigger({ noBlinkMs: noBlink })
  }

  if (s.detectionMode !== mode) {
    await switchMode(s.detectionMode)
  } else if (mode === 'timer' || webcamFallback) {
    startTimerLoop() // refresh interval
    notify()
  } else {
    notify()
  }
}

/** Fire a specific cue immediately (Settings → Preview), bypassing the trigger. */
export function previewCue(payload: CuePayload): void {
  fireCue(payload)
}

export function stopDetection(): void {
  clearTimers()
  destroyDetectorWindow()
}

export interface EngineSnapshot {
  mode: DetectionMode
  statusText: string
}

function statusText(): string {
  if (mode === 'timer') return `Timer · every ${Math.round(timerIntervalMs / 1000)}s`
  if (webcamFallback === 'no-permission') return 'Camera denied · using timer'
  if (webcamFallback === 'camera-in-use') return 'Camera in use · using timer'
  if (webcamFallback === 'error') return 'Detector error · using timer'
  switch (detectorStatus.state) {
    case 'loading':
      return 'Webcam · starting camera…'
    case 'running':
      return 'Webcam · watching your blinks'
    case 'no-face':
      return 'Webcam · paused (no face)'
    default:
      return 'Webcam'
  }
}

export function snapshot(): EngineSnapshot {
  return { mode, statusText: statusText() }
}
