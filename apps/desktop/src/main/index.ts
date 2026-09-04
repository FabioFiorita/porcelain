import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, dialog, type Session, session } from 'electron'
import { localSharingKeepsAppRunning } from './background-sharing'
import { startDaemon } from './daemon'
import { isDevelopmentProfile } from './development-profile'
import { registerTrpcHandler } from './ipc'
import { installAppMenu } from './menu'
import { installTray } from './tray'
import { shouldInstallTray } from './tray-policy'
import { initUpdater } from './updater'
import { createWindow } from './window'
import { startManagedWslEnvironments } from './wsl-environments'

// Dev gets its own config dir so `pnpm dev` never touches (or hijacks) the
// state of the installed app the user works in. The workspace launcher supplies
// the complete primary/worktree profile in PORCELAIN_USER_DATA; honoring it here
// makes Electron's own files and single-instance lock follow the same profile as
// the daemon. Keep the suffix fallback for direct package-local/e2e launches that
// intentionally do not provide a profile.
const developmentProfile = isDevelopmentProfile(is.dev)

if (developmentProfile) {
  app.setPath('userData', process.env.PORCELAIN_USER_DATA ?? `${app.getPath('userData')}-dev`)
}

// Porcelain is ONE process hosting N windows (File → New Window / ⌘⌥N add windows
// *within* it), so a second OS instance is always a bug: it would boot its own
// createWindow and a duplicate window pops up "on its own". A duplicate launch fails
// the single-instance lock and quits before whenReady, and the holder focuses an
// existing window via 'second-instance'. This MUST run after the development-profile setPath above:
// the lock is scoped to userData, so `pnpm dev` never contends with the packaged app
// and each Playwright e2e instance (own --user-data-dir) holds a DISTINCT lock. Never
// gate it on isPackaged — that leaves it live only in the build dev and e2e never run.
const gotInstanceLock = app.requestSingleInstanceLock()
if (!gotInstanceLock) {
  // A duplicate launch: the first instance owns the lock and focuses its window below.
  app.quit()
} else {
  app.on('second-instance', () => {
    const existing = BrowserWindow.getAllWindows().at(-1)
    if (!existing) return
    if (existing.isMinimized()) existing.restore()
    existing.focus()
  })
}

// Playwright e2e launches this built app and drives the renderer over CDP +
// screenshots the web contents directly, so the OS window never needs to appear.
// Gate test-only "stay hidden" behavior on this flag (set by the e2e fixture).
const isE2E = process.env.PORCELAIN_E2E === '1'

// `defaultSession` wrapped so the deprecated `getAllExtensions`/`loadExtension`
// calls inside electron-devtools-installer@4 resolve to `session.extensions.*`.
// The Proxy preserves the underlying `Session`, so the package keeps working
// while the deprecation warnings go away.
function extensionsCompatSession(): Session {
  const target = session.defaultSession
  return new Proxy(target, {
    get(ses: Session, prop: string | symbol): unknown {
      if (prop === 'getAllExtensions') return () => ses.extensions.getAllExtensions()
      if (prop === 'loadExtension')
        return (...args: Parameters<typeof ses.extensions.loadExtension>) =>
          ses.extensions.loadExtension(...args)
      if (prop === 'removeExtension')
        return (...args: Parameters<typeof ses.extensions.removeExtension>) =>
          ses.extensions.removeExtension(...args)
      const value = Reflect.get(ses, prop)
      return typeof value === 'function' ? value.bind(ses) : value
    },
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // The duplicate instance already called app.quit() above; never let its whenReady
  // boot a window or register the process-wide handlers.
  if (!gotInstanceLock) return

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.fabiofiorita.porcelain')

  // Keep e2e fully off the user's screen — no Dock icon bounce either.
  if (isE2E) app.dock?.hide()

  // One global shell-router handler for every window (ipcMain.handle is process-wide).
  registerTrpcHandler()
  installAppMenu()
  // macOS already exposes Porcelain through the Dock and application menu. The former
  // menu-bar icon duplicated that entry point without providing a useful action.
  if (shouldInstallTray(process.platform)) installTray()

  // Spawn the Electron-free daemon before the first window so the preload's synchronous daemon-url
  // getter has a port to hand out. The daemon owns HTTP procedures, the WebSocket session, project
  // state, and the profile-local agent channel.
  try {
    await startDaemon()
  } catch (error) {
    console.error('[daemon] initial start failed:', error)
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox(
      'Porcelain could not start',
      `The local Porcelain service did not become ready.\n\n${message}\n\nQuit and reopen Porcelain to try again.`,
    )
    app.quit()
    return
  }

  // Managed WSL daemons are secondary Environments. Restore them after the Windows-local
  // daemon is healthy; failures stay on their Settings rows and never prevent the app opening.
  void startManagedWslEnvironments().catch((error) => {
    console.error('[wsl] managed Environment restore failed:', error)
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  if (is.dev && !isE2E) {
    try {
      const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import(
        'electron-devtools-installer'
      )
      // electron-devtools-installer@4 still calls the deprecated
      // `session.getAllExtensions`/`loadExtension`. Route the two methods it
      // touches through the non-deprecated `session.extensions` API via a
      // Proxy (stays a `Session`, so no cast) until the package is updated.
      await installExtension(REACT_DEVELOPER_TOOLS, { session: extensionsCompatSession() })
    } catch (error) {
      console.log('[devtools] React DevTools install failed:', error)
    }
  }

  createWindow({ mode: 'restore' })
  initUpdater()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow({ mode: 'restore' })
  })
})

// A shared local daemon is the host for the user's other devices, so closing the last
// Windows/Linux window leaves the tray process and daemon alive. With no remote route we
// retain the platform's normal quit-on-close behavior. macOS already stays active until Quit.
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  void localSharingKeepsAppRunning().then((keepRunning) => {
    // A tray click or second launch may have opened a new window while status was in flight.
    if (!keepRunning && BrowserWindow.getAllWindows().length === 0) app.quit()
  })
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
