/**
 * Build/dev-time asset acquisition. Copies the MediaPipe WASM runtime out of
 * node_modules and downloads the Face Landmarker model into `resources/` so the app
 * can load everything from disk via the local `app://` protocol.
 *
 * This is a DEVELOPER action run from Node tooling — NOT the app. The shipped app
 * never touches the network (see src/main/network-guard.ts). Run: `npm run assets`.
 */
import { mkdir, copyFile, readdir, access, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const wasmDest = join(root, 'resources/wasm')
const modelDir = join(root, 'resources/models')
const modelPath = join(modelDir, 'face_landmarker.task')

// float16 variant: good accuracy, ~3.8MB. Official Google model storage.
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function copyWasm() {
  await mkdir(wasmDest, { recursive: true })
  const files = await readdir(wasmSrc)
  for (const f of files) {
    await copyFile(join(wasmSrc, f), join(wasmDest, f))
  }
  console.log(`✓ copied ${files.length} WASM files → resources/wasm/`)
}

async function fetchModel() {
  await mkdir(modelDir, { recursive: true })
  if (await exists(modelPath)) {
    console.log('✓ face_landmarker.task already present — skipping download')
    return
  }
  console.log('… downloading face_landmarker.task (one-time)')
  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`model download failed: ${res.status} ${res.statusText}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(modelPath, buf)
  console.log(`✓ downloaded face_landmarker.task (${(buf.length / 1e6).toFixed(1)} MB)`)
}

await copyWasm()
await fetchModel()
console.log('Assets ready.')
