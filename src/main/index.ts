import { app } from 'electron'
import { installNetworkGuard } from './network-guard'
import { registerAppScheme, registerAppProtocol } from './protocol'
import { initOverlays, destroyOverlays } from './overlay-manager'
import { createTray, rebuildMenu } from './tray'
import { installPermissionHandler } from './permissions'
import { initDetection, applySettings, stopDetection } from './detection'
import { registerSettingsIpc, openSettingsWindow } from './settings-window'
import { getSettings } from './store'

// Privileged scheme registration MUST happen before app `ready`.
registerAppScheme()

// Single instance — a second launch just focuses Settings.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => openSettingsWindow('settings'))
}

app.whenReady().then(async () => {
  // Menu-bar / background agent: no Dock icon by default.
  app.dock?.hide()

  installNetworkGuard()
  installPermissionHandler()
  registerAppProtocol()
  initOverlays()
  createTray()
  registerSettingsIpc()
  initDetection(rebuildMenu)

  if (getSettings().onboarded) {
    await applySettings()
  } else {
    // First run: guide the user; the engine starts when onboarding completes.
    openSettingsWindow('onboarding')
  }
})

// Tray app: keep running even though the only windows are hidden overlays.
app.on('window-all-closed', () => {
  // Intentionally do not quit; the app lives in the menu bar until "Quit".
})

app.on('before-quit', () => {
  stopDetection()
  destroyOverlays()
})
