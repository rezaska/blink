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
let pausedUntil: number | null = null
let resumeTimer: ReturnType<typeof setTimeout> | null = null
let onChange: (() => void) | null = null
let onCueFired: (() => void) | null = null

function isPaused(): boolean {
  return pausedUntil !== null && Date.now() < pausedUntil
}

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
  onCueFired?.()
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
export function initDetection(onStatusChange: () => void, cueFired?: () => void): void {
  onChange = onStatusChange
  onCueFired = cueFired ?? null
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

  // While paused, just remember the desired mode; resume applies it.
  if (isPaused()) {
    mode = s.detectionMode
    notify()
    return
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

function clearResumeTimer(): void {
  if (resumeTimer) clearTimeout(resumeTimer)
  resumeTimer = null
}

/** Pause all reminders for `ms`, turning the camera off; auto-resumes when it elapses. */
export function pauseFor(ms: number): void {
  clearResumeTimer()
  clearTimers()
  destroyDetectorWindow()
  pausedUntil = Date.now() + ms
  resumeTimer = setTimeout(() => resume(), ms)
  notify()
}

/** Pause until 8:00 AM tomorrow (local). */
export function pauseUntilTomorrow(): void {
  const now = new Date()
  const wake = new Date(now)
  wake.setDate(now.getDate() + 1)
  wake.setHours(8, 0, 0, 0)
  pauseFor(wake.getTime() - now.getTime())
}

export function resume(): void {
  clearResumeTimer()
  pausedUntil = null
  void switchMode(mode) // restart the current mode from scratch
}

/** Fire a specific cue immediately (Settings → Preview), bypassing the trigger. */
export function previewCue(payload: CuePayload): void {
  fireCue(payload)
}

export function stopDetection(): void {
  clearTimers()
  destroyDetectorWindow()
}

export type TrayState = 'monitoring' | 'paused' | 'no-camera'

export interface EngineSnapshot {
  mode: DetectionMode
  statusText: string
  trayState: TrayState
  paused: boolean
  resumeText: string | null
}

function trayState(): TrayState {
  if (isPaused()) return 'paused'
  if (mode === 'timer') return 'monitoring'
  if (webcamFallback === 'no-permission' || webcamFallback === 'camera-in-use' || webcamFallback === 'error') {
    return 'no-camera'
  }
  if (detectorStatus.state === 'no-face') return 'paused'
  return 'monitoring'
}

function resumeClock(): string | null {
  if (pausedUntil === null) return null
  return new Date(pausedUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function statusText(): string {
  if (isPaused()) return `Paused · resumes ${resumeClock()}`
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
  return {
    mode,
    statusText: statusText(),
    trayState: trayState(),
    paused: isPaused(),
    resumeText: resumeClock()
  }
}
