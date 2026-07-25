import type { BlinkOverlayApi } from '../preload/overlay'
import type { BlinkDetectorApi } from '../preload/detector'
import type { BlinkSettingsApi } from '../preload/settings'

declare global {
  interface Window {
    blink: BlinkOverlayApi
    blinkDetector: BlinkDetectorApi
    blinkSettings: BlinkSettingsApi
  }
}

export {}
