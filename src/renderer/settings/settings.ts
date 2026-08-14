import {
  SENSITIVITY_MS,
  type Settings,
  type CueType,
  type CuePayload,
  type DetectionMode,
  type Sensitivity
} from '../../shared/types'

const api = window.blinkSettings
const app = document.getElementById('app')!

let settings: Settings

// ---------- helpers ----------

function el(html: string): HTMLElement {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild as HTMLElement
}

/** Ask the main process to size the window to the rendered content. */
function fitWindow(): void {
  // +2px buffer so a fractional pixel never triggers a scrollbar.
  requestAnimationFrame(() => api.resize(Math.ceil(app.getBoundingClientRect().height) + 2))
}

const CUE_DESC: Record<CueType, string> = {
  blur: 'A soft frosted pulse. Turn on Real frost below for a true macOS blur.',
  dim: 'The screen gently darkens, then lifts.',
  glow: 'A soft glow breathes around the screen edges.'
}

function cuePayloadFrom(s: Pick<Settings, 'cueType' | 'intensity' | 'glowColor' | 'macVibrancyBlur'>): CuePayload {
  return {
    type: s.cueType,
    intensity: s.intensity,
    color: s.cueType === 'glow' ? s.glowColor : undefined,
    strongFrost: s.cueType === 'blur' ? s.macVibrancyBlur : undefined
  }
}

// ---------- onboarding ----------

function renderOnboarding(fromSettings = false): void {
  const draft: Settings = { ...settings }
  let step = 0
  const STEPS = 5
  // Calibration uses a fixed, non-resizable window so steps don't resize or scroll,
  // with its content centered.
  api.onboardingSize()
  document.body.classList.add('onboarding')
  // Ordered steps, so a Back button can return to the previous one (declarations hoist).
  const steps: Array<() => void> = [welcome, detection, tasting, sensitivity, done]

  const mount = (inner: HTMLElement, primary: HTMLElement) => {
    app.innerHTML = ''
    const card = el('<div class="card"></div>')
    card.appendChild(inner)

    // Action row inside the card: Back on the left (from step 2 on), primary in the right corner.
    const actions = el('<div class="ob-actions"></div>')
    if (step > 0) {
      const back = el('<button class="ghost">Back</button>')
      const target = steps[step - 1]
      back.addEventListener('click', () => target())
      actions.appendChild(back)
    } else {
      actions.appendChild(el('<div></div>')) // spacer keeps the primary in the right corner
    }
    actions.appendChild(primary)
    card.appendChild(actions)
    app.appendChild(card)

    // Centered pagination below the card.
    const dots = el('<div class="steps"></div>')
    for (let i = 0; i < STEPS; i++) dots.appendChild(el(`<div class="dot ${i === step ? 'active' : ''}"></div>`))
    app.appendChild(dots)

    // When launched from Settings (not first run), offer a way back without finishing.
    if (fromSettings) {
      const cancel = el('<button class="cancel-link">Cancel and return to settings</button>')
      cancel.addEventListener('click', () => renderSettings())
      app.appendChild(cancel)
    }
    // No per-step fit: the window is a fixed calibration size (see api.onboardingSize).
  }

  const nextBtn = (label = 'Continue', onClick: () => void) => {
    const b = el(`<button class="primary">${label}</button>`)
    b.addEventListener('click', onClick)
    return b
  }

  function welcome(): void {
    step = 0
    const inner = el(`
      <div>
        <p class="eyebrow">Welcome to Blink</p>
        <h1>Give your eyes a break</h1>
        <p class="muted">When we focus on a screen, we blink up to 4× less than normal - which
        leaves eyes dry and sore. Blink gives you gentle, ambient reminders to blink, without
        popups that break your focus.</p>
        <div class="privacy-note"><strong>Private by design.</strong> Blink does not send or
        receive any data over the network. If you enable the optional webcam mode, everything runs
        on your Mac - video frames are analysed in memory and never saved, shown, or sent anywhere.</div>
      </div>
    `)
    mount(inner, nextBtn('Get started', detection))
  }

  function detection(): void {
    step = 1
    const inner = el(`
      <div>
        <p class="eyebrow">Step 1 · Detection</p>
        <h2>How should Blink decide when to remind you?</h2>
        <div class="choices"></div>
        <p class="hint" id="cam-hint"></p>
      </div>
    `)
    const choices = inner.querySelector('.choices')!
    const opt = (mode: DetectionMode, title: string, desc: string) => {
      const c = el(`<button class="choice ${draft.detectionMode === mode ? 'active' : ''}">
        <div><div class="title">${title}</div><div class="desc">${desc}</div></div></button>`)
      c.addEventListener('click', () => {
        draft.detectionMode = mode
        choices.querySelectorAll('.choice').forEach((n) => n.classList.remove('active'))
        c.classList.add('active')
      })
      return c
    }
    choices.appendChild(opt('timer', 'Timer (recommended to start)', 'A gentle reminder on a fixed schedule. No camera - nothing to allow.'))
    choices.appendChild(opt('webcam', 'Webcam (opt-in)', 'Smarter: only nudges you when you actually stop blinking. 100% on-device.'))

    const cont = nextBtn('Continue', async () => {
      if (draft.detectionMode === 'webcam') {
        const hint = inner.querySelector('#cam-hint') as HTMLElement
        hint.textContent = 'Requesting camera permission…'
        const res = await api.requestCamera()
        if (res === 'denied') {
          draft.detectionMode = 'timer'
          hint.textContent = 'Camera not allowed - Blink will use Timer mode. You can enable the camera later in Settings.'
          return
        }
      }
      tasting()
    })
    mount(inner, cont)
  }

  function tasting(): void {
    step = 2
    const inner = el(`
      <div>
        <p class="eyebrow">Step 2 · Try the cues</p>
        <h2>Which reminder do you notice - without losing your place?</h2>
        <p class="tasting-text">Read this line while the cues play. A good cue nudges the corner of
        your attention just enough to blink, then fades away before it interrupts your train of
        thought.</p>
        <div class="choices"></div>
        <div><button class="ghost" id="replay">↺ Play all three again</button></div>
      </div>
    `)
    const choices = inner.querySelector('.choices')!
    const cueTypes: CueType[] = ['blur', 'dim', 'glow']
    const setActive = (t: CueType) => {
      draft.cueType = t
      choices.querySelectorAll('.choice').forEach((n) => n.classList.toggle('active', n.getAttribute('data-cue') === t))
    }
    for (const t of cueTypes) {
      const c = el(`<button class="choice ${draft.cueType === t ? 'active' : ''}" data-cue="${t}">
        <div><div class="title">${t[0].toUpperCase() + t.slice(1)}</div>
        <div class="desc">${CUE_DESC[t]}</div></div></button>`)
      c.addEventListener('click', () => {
        setActive(t)
        api.previewCue(cuePayloadFrom({ ...draft, cueType: t }))
      })
      choices.appendChild(c)
    }
    const playAll = () => {
      cueTypes.forEach((t, i) =>
        setTimeout(() => api.previewCue(cuePayloadFrom({ ...draft, cueType: t })), i * 3800)
      )
    }
    inner.querySelector('#replay')!.addEventListener('click', playAll)

    mount(inner, nextBtn('Continue', sensitivity))
    playAll()
  }

  function sensitivity(): void {
    step = 3
    const inner = el(`
      <div>
        <p class="eyebrow">Step 3 · Sensitivity</p>
        <h2>How soon should a reminder appear?</h2>
        <div class="choices"></div>
      </div>
    `)
    const choices = inner.querySelector('.choices')!
    const opts: [Sensitivity, string][] = [
      ['relaxed', 'Relaxed - after 12s without a blink'],
      ['standard', 'Standard - after 8s'],
      ['attentive', 'Attentive - after 5s']
    ]
    for (const [s, label] of opts) {
      const c = el(`<button class="choice ${draft.sensitivity === s ? 'active' : ''}">
        <div><div class="title">${label}</div></div></button>`)
      c.addEventListener('click', () => {
        draft.sensitivity = s
        choices.querySelectorAll('.choice').forEach((n) => n.classList.remove('active'))
        c.classList.add('active')
      })
      choices.appendChild(c)
    }
    const note =
      draft.detectionMode === 'timer'
        ? 'In Timer mode this maps to the reminder interval.'
        : ''
    if (note) inner.appendChild(el(`<p class="hint">${note}</p>`))
    mount(inner, nextBtn('Continue', done))
  }

  function done(): void {
    step = 4
    const modeText = draft.detectionMode === 'webcam' ? 'Webcam (on-device)' : 'Timer'
    const inner = el(`
      <div>
        <p class="eyebrow">All set</p>
        <h1>You're ready to blink!</h1>
        <p class="muted">Blink lives in your menu bar. Open it any time to tweak things or pause.</p>
        <div class="privacy-note">Detection: <strong>${modeText}</strong> · Cue:
        <strong>${draft.cueType}</strong> · Sensitivity: <strong>${draft.sensitivity}</strong></div>
      </div>
    `)
    const start = nextBtn('Start Blinking', async () => {
      await api.finishOnboarding(draft)
      api.close()
    })
    mount(inner, start)
  }

  welcome()
}

// ---------- settings panel ----------

function renderSettings(): void {
  const dataFolder = '' // shown via reveal button; path not needed inline

  document.body.classList.remove('onboarding')
  app.innerHTML = ''
  app.appendChild(el(`<h1>Blink settings</h1>`))

  // --- Cue card ---
  // The description slot reserves a fixed height so the "Cue type" row doesn't resize as
  // the description text changes. Blur/Glow add one option row (frost / colour); Dim has none.
  const cueCard = el('<div class="card"><h2>Reminder cue</h2></div>')
  const cueSeg = segment(['blur', 'dim', 'glow'], settings.cueType, (v) => update({ cueType: v as CueType }))
  cueCard.appendChild(rowNode('Cue type', CUE_DESC[settings.cueType], cueSeg, 'cue-desc'))

  const previewBtn = el('<button>Preview</button>')
  previewBtn.addEventListener('click', () => api.previewCue(cuePayloadFrom(settings)))
  cueCard.appendChild(rowNode('Preview', '', previewBtn))

  const slider = el(`<input type="range" min="0.2" max="1" step="0.05" value="${settings.intensity}" />`) as HTMLInputElement
  const setFill = () => {
    const pct = ((Number(slider.value) - 0.2) / 0.8) * 100
    slider.style.setProperty('--range-fill', `${pct}%`)
  }
  setFill()
  slider.addEventListener('input', () => {
    setFill()
    update({ intensity: Number(slider.value) }, false)
  })
  slider.addEventListener('change', () => api.previewCue(cuePayloadFrom(settings)))
  cueCard.appendChild(rowNode('Intensity', '', slider))

  const optionRow = cueOptionRow()
  if (optionRow) cueCard.appendChild(optionRow)
  app.appendChild(cueCard)

  // --- Detection card ---
  const detCard = el('<div class="card"><h2>Detection</h2></div>')
  detCard.appendChild(
    rowNode(
      'Mode',
      settings.detectionMode === 'webcam' ? 'On-device webcam. Camera used only here.' : 'Fixed interval. No camera.',
      segment(['timer', 'webcam'], settings.detectionMode, async (v) => {
        await update({ detectionMode: v as DetectionMode })
      })
    )
  )
  // Sensitivity + exact seconds only matter in webcam mode (they gate the no-blink
  // threshold); the timer interval only matters in timer mode. Show only what applies.
  if (settings.detectionMode === 'webcam') {
    const sensSeg = segment(['relaxed', 'standard', 'attentive'], settings.sensitivity, (v) =>
      update({ sensitivity: v as Sensitivity, advancedNoBlinkMs: null })
    )
    detCard.appendChild(
      rowNode(
        'Sensitivity',
        `Reminder after ${(settings.advancedNoBlinkMs ?? SENSITIVITY_MS[settings.sensitivity]) / 1000}s without a blink.`,
        sensSeg
      )
    )

    const secs = el(`<input type="number" min="2" max="60" step="1" value="${Math.round((settings.advancedNoBlinkMs ?? SENSITIVITY_MS[settings.sensitivity]) / 1000)}" />`) as HTMLInputElement
    secs.addEventListener('change', () => update({ advancedNoBlinkMs: Math.max(2, Number(secs.value)) * 1000 }))
    detCard.appendChild(rowNode('Advanced: exact seconds', 'Override the preset.', secs))
  } else {
    const interval = el(`<input type="number" min="10" max="600" step="5" value="${Math.round(settings.timerIntervalMs / 1000)}" />`) as HTMLInputElement
    interval.addEventListener('change', () => update({ timerIntervalMs: Math.max(10, Number(interval.value)) * 1000 }))
    detCard.appendChild(rowNode('Timer interval (s)', 'How often the timer fires.', interval))
  }
  app.appendChild(detCard)

  // --- General card ---
  const genCard = el('<div class="card"><h2>General</h2></div>')
  genCard.appendChild(
    toggleRow('Launch at login', '', settings.launchAtLogin, (v) => update({ launchAtLogin: v }))
  )
  const recalib = el('<button class="ghost">Re-run calibration…</button>')
  recalib.addEventListener('click', () => {
    settings = { ...settings }
    renderOnboarding(true)
  })
  genCard.appendChild(rowNode('Calibration', '', recalib))
  app.appendChild(genCard)

  // --- Privacy card ---
  const privCard = el('<div class="card"><h2>Privacy &amp; data</h2></div>')
  privCard.appendChild(
    el(`<div class="privacy-note">Blink does <strong>not send or receive any data over the network</strong>.
    No accounts, analytics, updater, or crash reporting. Your settings and stats are stored only on this
    Mac, as plain JSON.</div>`)
  )
  const policyBtn = el('<button>View ↗</button>')
  policyBtn.addEventListener('click', () => api.openPrivacy())
  privCard.appendChild(rowNode('Privacy policy', '', policyBtn))

  const reveal = el('<button>Reveal data folder</button>')
  reveal.addEventListener('click', () => api.revealDataFolder())
  privCard.appendChild(rowNode('Local data', 'See exactly where your data lives.', reveal))

  const exportBtn = el('<button>Export…</button>')
  exportBtn.addEventListener('click', async () => {
    const res = await api.exportData()
    if (res.ok) exportBtn.textContent = 'Exported ✓'
  })
  privCard.appendChild(rowNode('Export data', '', exportBtn))

  const del = el('<button class="danger">Delete all data</button>')
  del.addEventListener('click', async () => {
    if (del.dataset.armed !== '1') {
      del.dataset.armed = '1'
      del.textContent = 'Click again to confirm'
      return
    }
    await api.deleteAllData()
    settings = await api.getSettings()
    void renderSettings()
  })
  const delWrap = el('<div class="center-row"></div>')
  delWrap.appendChild(del)
  privCard.appendChild(delWrap)
  app.appendChild(privCard)
  void dataFolder
  // Size the window to the full content (capped to the screen, then it scrolls), so you
  // can see everything at once whenever it fits.
  fitWindow()
}

/** The cue-specific option row: a frost toggle for Blur, a colour for Glow, none for Dim. */
function cueOptionRow(): HTMLElement | null {
  let row: HTMLElement
  if (settings.cueType === 'blur') {
    const sw = el(`<input type="checkbox" class="switch" ${settings.macVibrancyBlur ? 'checked' : ''} />`) as HTMLInputElement
    sw.addEventListener('change', () => update({ macVibrancyBlur: sw.checked }))
    row = rowNode('Real frost (macOS)', 'A true macOS blur of the screen behind the cue.', sw)
  } else if (settings.cueType === 'glow') {
    const color = el(`<input type="color" value="${settings.glowColor}" />`) as HTMLInputElement
    color.addEventListener('change', () => update({ glowColor: color.value }))
    row = rowNode('Glow colour', '', color)
  } else {
    return null // Dim has no extra options.
  }
  row.classList.add('cue-option')
  return row
}

// ---------- small UI builders ----------

function rowNode(label: string, sub: string, control: HTMLElement, subId?: string): HTMLElement {
  const row = el('<div class="row"></div>')
  const left = el(`<div><div class="label">${label}</div>${sub ? `<div class="sub"${subId ? ` id="${subId}"` : ''}>${sub}</div>` : ''}</div>`)
  row.appendChild(left)
  row.appendChild(control)
  return row
}

function segment(values: string[], current: string, onPick: (v: string) => void): HTMLElement {
  const seg = el('<div class="seg"></div>')
  for (const v of values) {
    const b = el(`<button class="${v === current ? 'active' : ''}">${v[0].toUpperCase() + v.slice(1)}</button>`)
    b.addEventListener('click', () => onPick(v))
    seg.appendChild(b)
  }
  return seg
}

function toggleRow(label: string, sub: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const input = el(`<input type="checkbox" class="switch" ${checked ? 'checked' : ''} />`) as HTMLInputElement
  input.addEventListener('change', () => onChange(input.checked))
  return rowNode(label, sub, input)
}

/**
 * Apply a settings change optimistically: update local state and re-render immediately
 * (no waiting on IPC), then persist in the background. Keeps selection instant.
 */
async function update(patch: Partial<Settings>, rerender = true): Promise<void> {
  settings = { ...settings, ...patch }
  if (rerender) renderSettings()
  settings = await api.setSettings(patch)
}

// ---------- support ----------

function renderSupport(): void {
  document.body.classList.remove('onboarding')
  app.innerHTML = ''
  app.appendChild(el('<h1>Support Blink</h1>'))

  const card = el('<div class="card"></div>')
  card.appendChild(
    el(
      `<p class="muted">Blink is free, private, and made with care. If it has helped keep your
      eyes comfortable, you can buy me a coffee to support its ongoing development. Thank you.</p>`
    )
  )
  const actions = el('<div class="center-row"></div>')
  const open = el('<button class="primary">Buy me a coffee ↗</button>')
  open.addEventListener('click', () => {
    api.openKofi()
    api.close() // close the window as soon as the link is opened
  })
  actions.appendChild(open)
  card.appendChild(actions)
  card.appendChild(
    el('<p class="hint center">Opens a secure donation page (Ko-fi) in your browser. Blink itself sends nothing.</p>')
  )
  app.appendChild(card)
  fitWindow()
}

// ---------- bootstrap ----------

async function init(): Promise<void> {
  settings = await api.getSettings()
  const params = new URLSearchParams(location.search)
  let view = params.get('view') ?? 'auto'
  if (view === 'auto') view = await api.getInitialView()
  if (view === 'onboarding') renderOnboarding()
  else if (view === 'support') renderSupport()
  else renderSettings()
}

void init()
