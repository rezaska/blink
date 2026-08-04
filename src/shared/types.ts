import type { CueTiming } from './cue-timing'

export type CueType = 'blur' | 'dim' | 'glow'

/** Sent from the main process to overlay renderers to fire one cue. */
export interface CuePayload {
  type: CueType
  /** Peak intensity 0..1 (maps to blur strength / dim opacity / glow strength). */
  intensity: number
  /** Glow color (CSS color). Only used by the "glow" cue. */
  color?: string
  /** Fade envelope; defaults applied by the renderer when omitted. */
  timing?: CueTiming
  /** Blur cue only: use the stronger frosted look (macOS "real frost" preference). */
  strongFrost?: boolean
}

export const DEFAULT_GLOW_COLOR = '#2dd4bf' // teal

export type DetectionMode = 'timer' | 'webcam'

/** Sensitivity presets → no-blink threshold in ms (see plan). */
export const SENSITIVITY_MS = {
  relaxed: 12_000,
  standard: 8_000,
  attentive: 5_000
} as const
export type Sensitivity = keyof typeof SENSITIVITY_MS

/** Lifecycle/health of the webcam detector, surfaced to the tray. */
export type DetectorState =
  | 'loading'
  | 'running'
  | 'no-face'
  | 'no-permission'
  | 'camera-in-use'
  | 'error'

export interface DetectorStatus {
  state: DetectorState
  detail?: string
}

/** Persisted user settings. */
export interface Settings {
  onboarded: boolean
  detectionMode: DetectionMode
  cueType: CueType
  /** Peak cue intensity 0..1 (blur strength / dim opacity / glow strength). */
  intensity: number
  sensitivity: Sensitivity
  /** Optional exact no-blink override (ms); when set, wins over the preset. */
  advancedNoBlinkMs: number | null
  /** Timer-mode interval in ms. */
  timerIntervalMs: number
  glowColor: string
  launchAtLogin: boolean
  /** macOS "real frost" vibrancy variant for the blur cue. */
  macVibrancyBlur: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  detectionMode: 'timer',
  cueType: 'blur',
  intensity: 1,
  sensitivity: 'standard',
  advancedNoBlinkMs: null,
  timerIntervalMs: 60_000,
  glowColor: DEFAULT_GLOW_COLOR,
  launchAtLogin: false,
  macVibrancyBlur: false
}

/** Per-day locally-stored stats (aggregates only - no raw event history). */
export interface DayStats {
  /** ISO date, e.g. "2026-07-22". */
  date: string
  blinks: number
  cues: number
  bpmSum: number
  bpmSamples: number
}

/** Summary shown in Settings → Stats. */
export interface StatsSummary {
  todayAvgBpm: number | null
  todayCues: number
  yesterdayAvgBpm: number | null
  /** today − yesterday average BPM, or null if not comparable. */
  bpmTrend: number | null
}

/** IPC channel names, kept in one place to avoid typos across processes. */
export const IPC = {
  cueFire: 'cue:fire',
  detectorBlink: 'detector:blink',
  detectorStatus: 'detector:status',
  // settings/onboarding (renderer ↔ main)
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  getStats: 'stats:get',
  previewCue: 'settings:previewCue',
  requestCamera: 'settings:requestCamera',
  revealDataFolder: 'settings:revealDataFolder',
  exportData: 'settings:exportData',
  deleteAllData: 'settings:deleteAllData',
  getInitialView: 'settings:getInitialView',
  finishOnboarding: 'settings:finishOnboarding',
  closeSettings: 'settings:close',
  resizeSettings: 'settings:resize',
  onboardingSize: 'settings:onboardingSize'
} as const
