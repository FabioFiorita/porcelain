import { settleBackground } from '@shared/background'
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { isDevelopmentProfile } from './development-profile'
import { broadcastShellEvent } from './shell-events'
import { updaterUnavailableReason } from './updater-availability'

export interface UpdateStatus {
  state: 'unavailable' | 'idle' | 'checking' | 'available' | 'downloaded' | 'up-to-date' | 'error'
  /** Version of the update this state refers to, when known. */
  version: string | null
  error: string | null
  currentVersion: string
  /** Why this shell cannot self-update. Null when the updater is available. */
  unavailableReason: string | null
}

const unavailableReason = updaterUnavailableReason(
  app.isPackaged,
  process.platform,
  process.env.APPIMAGE,
  isDevelopmentProfile(!app.isPackaged),
)
let status: UpdateStatus = {
  state: unavailableReason === null ? 'idle' : 'unavailable',
  version: null,
  error: null,
  currentVersion: app.getVersion(),
  unavailableReason,
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
  if (status.state === 'unavailable') return
  // Linux auto-update only exists for the AppImage target (electron-updater
  // detects it via $APPIMAGE); a deb install has no auto-update path, so bail
  // rather than error on every check.
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
    // 'error' listener already captured the reason, and the shell renders it as the
    // update status the user sees instead.
    settleBackground(autoUpdater.checkForUpdates(), 'fallback')
  }
  check()
  setInterval(check, CHECK_INTERVAL)
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (status.state !== 'unavailable') {
    await autoUpdater.checkForUpdates().catch((error: unknown) => {
      // The 'error' listener already wrote the reason into `status`, which is what this
      // returns to the caller — but the check must still be awaited before reading it.
      console.error('[updater] check failed:', error)
    })
  }
  return status
}

export function installUpdate(): void {
  if (status.state !== 'downloaded')
    throw new Error('No downloaded Porcelain update is ready to install')
  autoUpdater.quitAndInstall()
}
