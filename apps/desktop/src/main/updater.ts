import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { broadcastShellEvent } from './shell-events'

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloaded' | 'up-to-date' | 'error'
  /** Version of the update this state refers to, when known. */
  version: string | null
  error: string | null
  currentVersion: string
}

let status: UpdateStatus = {
  state: 'idle',
  version: null,
  error: null,
  currentVersion: app.getVersion(),
}

function setStatus(next: Partial<UpdateStatus>): void {
  status = { ...status, ...next }
  // The updater lives in the shell, so its push rides the shell-event channel —
  // NOT the daemon's app-event bus (the daemon knows nothing about updates).
  broadcastShellEvent('update-status')
}

export const updateStatus = (): UpdateStatus => status

const CHECK_INTERVAL = 4 * 60 * 60 * 1000

/** Wire auto-update against GitHub releases. No-op in dev (no app-update.yml). */
export function initUpdater(): void {
  if (!app.isPackaged) return
  // Linux auto-update only exists for the AppImage target (electron-updater
  // detects it via $APPIMAGE); a deb install has no auto-update path, so bail
  // rather than error on every check.
  if (process.platform === 'linux' && !process.env.APPIMAGE) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking', error: null }))
  autoUpdater.on('update-available', (info) =>
    setStatus({ state: 'available', version: info.version }),
  )
  autoUpdater.on('update-not-available', () => setStatus({ state: 'up-to-date', version: null }))
  autoUpdater.on('update-downloaded', (info) =>
    setStatus({ state: 'downloaded', version: info.version }),
  )
  autoUpdater.on('error', (error) => setStatus({ state: 'error', error: error.message }))

  const check = (): void => {
    autoUpdater.checkForUpdates().catch(() => {
      // 'error' listener already captured the reason
    })
  }
  check()
  setInterval(check, CHECK_INTERVAL)
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (app.isPackaged) {
    await autoUpdater.checkForUpdates().catch(() => {})
  }
  return status
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
