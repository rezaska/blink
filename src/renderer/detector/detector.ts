import { FilesetResolver, FaceLandmarker, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { BlinkDetector } from '../../shared/ear'
import type { DetectorState } from '../../shared/types'

/**
 * Hidden webcam blink detector. Runs 100% locally: WASM + model are loaded from the
 * app:// scheme (no network), frames live only in the <video> buffer for the current
 * inference, and only derived signals (a blink happened / face presence) leave here.
 */

const WASM_BASE = 'app://blink/wasm'
const MODEL_URL = 'app://blink/models/face_landmarker.task'

const TARGET_FPS = 10
const FRAME_MS = 1000 / TARGET_FPS
const NO_FACE_MS = 1500

// Openness = 1 - max(eyeBlinkLeft, eyeBlinkRight). Blink score spikes ~0.7-1.0 while
// blinking, so openness dips below ~0.5. Thresholds are tuned for this signal (not EAR).
const blink = new BlinkDetector({
  closeThreshold: 0.5,
  openThreshold: 0.6,
  minClosedMs: 30,
  maxClosedMs: 500
})

let currentState: DetectorState | null = null
function setState(state: DetectorState, detail?: string): void {
  if (state === currentState) return
  currentState = state
  window.blinkDetector.status({ state, detail })
}

async function openCamera(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, frameRate: TARGET_FPS },
      audio: false
    })
  } catch (err) {
    const name = (err as DOMException)?.name
    if (name === 'NotAllowedError' || name === 'SecurityError') setState('no-permission')
    else if (name === 'NotReadableError' || name === 'AbortError')
      setState('camera-in-use', String(err))
    else setState('error', String(err))
    return null
  }
}

async function createLandmarker(): Promise<FaceLandmarker | null> {
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
    for (const delegate of ['GPU', 'CPU'] as const) {
      try {
        return await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true
        })
      } catch (err) {
        if (delegate === 'CPU') throw err
        console.warn('[detector] GPU delegate failed, falling back to CPU:', err)
      }
    }
    return null
  } catch (err) {
    setState('error', 'model: ' + String(err))
    return null
  }
}

function opennessFromResult(result: FaceLandmarkerResult): number | null {
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null
  const categories = result.faceBlendshapes?.[0]?.categories
  if (!categories) return 1 // face but no blendshapes → treat as open
  let left = 0
  let right = 0
  for (const c of categories) {
    if (c.categoryName === 'eyeBlinkLeft') left = c.score
    else if (c.categoryName === 'eyeBlinkRight') right = c.score
  }
  return 1 - Math.max(left, right)
}

async function main(): Promise<void> {
  setState('loading')

  const stream = await openCamera()
  if (!stream) return

  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  await video.play()

  const landmarker = await createLandmarker()
  if (!landmarker) return

  setState('running')
  let lastFaceAt = performance.now()

  setInterval(() => {
    const now = performance.now()
    let result: FaceLandmarkerResult
    try {
      result = landmarker.detectForVideo(video, now)
    } catch (err) {
      console.error('[detector] inference error:', err)
      return
    }

    const openness = opennessFromResult(result)
    if (openness === null) {
      if (now - lastFaceAt > NO_FACE_MS) setState('no-face')
      return
    }

    lastFaceAt = now
    setState('running')
    if (blink.update(openness, now)) {
      window.blinkDetector.blink()
    }
  }, FRAME_MS)
}

void main()
