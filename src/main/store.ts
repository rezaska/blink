import Store from 'electron-store'
import { app, dialog, shell, type BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  DEFAULT_SETTINGS,
  type Settings,
  type DayStats,
  type StatsSummary
} from '../shared/types'

/**
 * Local-only persistence for settings + stats (electron-store → a single JSON file in
 * the OS app-data folder). Nothing here ever leaves the machine. Stores only derived
 * daily aggregates, not raw per-event history, and keeps a bounded retention window.
 */

interface Schema {
  settings: Settings
  stats: Record<string, DayStats>
}

const RETENTION_DAYS = 14

let _store: Store<Schema> | null = null
// Lazy so we never touch app paths before `ready`.
function store(): Store<Schema> {
  if (!_store) {
    _store = new Store<Schema>({
      name: 'blink',
      defaults: { settings: DEFAULT_SETTINGS, stats: {} }
    })
  }
  return _store
}

// --- settings ---

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...store().get('settings') }
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  store().set('settings', next)
  return next
}

// --- stats ---

function dateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function bumpToday(mutate: (day: DayStats) => void): void {
  const key = dateKey()
  const stats = store().get('stats')
  const day = stats[key] ?? { date: key, blinks: 0, cues: 0, bpmSum: 0, bpmSamples: 0 }
  mutate(day)
  stats[key] = day
  // Retention: keep only the most recent RETENTION_DAYS days.
  const keys = Object.keys(stats).sort()
  while (keys.length > RETENTION_DAYS) {
    const oldest = keys.shift()
    if (oldest) delete stats[oldest]
  }
  store().set('stats', stats)
}

export function recordBlink(): void {
  bumpToday((d) => {
    d.blinks++
  })
}

export function recordCue(): void {
  bumpToday((d) => {
    d.cues++
  })
}

export function recordBpmSample(bpm: number): void {
  bumpToday((d) => {
    d.bpmSum += bpm
    d.bpmSamples++
  })
}

export function getStatsSummary(): StatsSummary {
  const stats = store().get('stats')
  const today = stats[dateKey()]
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yest = stats[dateKey(yesterday)]

  const avg = (s?: DayStats): number | null =>
    s && s.bpmSamples > 0 ? s.bpmSum / s.bpmSamples : null

  const todayAvgBpm = avg(today)
  const yesterdayAvgBpm = avg(yest)
  return {
    todayAvgBpm,
    todayCues: today?.cues ?? 0,
    yesterdayAvgBpm,
    bpmTrend:
      todayAvgBpm !== null && yesterdayAvgBpm !== null ? todayAvgBpm - yesterdayAvgBpm : null
  }
}

// --- data sovereignty controls ---

/** Absolute path to the folder holding the local data file. */
export function dataFolderPath(): string {
  return dirname(store().path)
}

export function revealDataFolder(): void {
  shell.showItemInFolder(store().path)
}

export async function exportData(win: BrowserWindow | null): Promise<{ ok: boolean; path?: string }> {
  const options = {
    title: 'Export Blink data',
    defaultPath: 'blink-data.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  }
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return { ok: false }

  const payload = {
    app: 'blink',
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    stats: store().get('stats')
  }
  await writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8')
  return { ok: true, path: result.filePath }
}

/** Wipe everything and return to first-run state. */
export function deleteAllData(): void {
  store().clear()
  store().set('settings', DEFAULT_SETTINGS)
  store().set('stats', {})
}

/** Apply the OS launch-at-login setting from the persisted preference. */
export function applyLaunchAtLogin(): void {
  // Unsigned dev builds can't register a login item ("Operation not permitted"); it works
  // in a packaged/signed app. Skip in dev to avoid noisy errors.
  if (!app.isPackaged) return
  try {
    app.setLoginItemSettings({ openAtLogin: getSettings().launchAtLogin, openAsHidden: true })
  } catch (err) {
    console.warn('[store] setLoginItemSettings failed:', err)
  }
}
