import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, type Session, session } from 'electron'
import { seedDevConfig } from './dev-config'
import { registerTerminalHandlers, registerTrpcHandler } from './ipc'
import { migrateLayersFromConfig } from './layers-store'
import { shutdownAllLsp } from './lsp-manager'
import { installAppMenu } from './menu'
import { migrateNotesFromConfig } from './notes-store'
import { watchAgentChannels } from './review-watch'
import { migrateReviewedFromConfig } from './reviewed-store'
import { createWindow } from './window'

// Dev gets its own config dir so `pnpm dev` never touches (or hijacks) the
// state of the installed app the user works in. Must run before anything
// reads userData (the config store is lazy, so before whenReady is enough).
if (is.dev) {
  app.setPath('userData', `${app.getPath('userData')}-dev`)
}

import { initUpdater } from './updater'

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
    get(ses, prop) {
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

// Porcelain runs as ONE process hosting N windows (the multi-window model shares a
// single stateless tRPC handler), so a second OS *instance* is always a bug: it boots
// its own createWindow({ mode: 'restore' }) and a duplicate window of the last repo
// pops up "on its own" when something relaunches the binary past macOS's
// activate-instead-of-launch coordination. Hold a single-instance lock so a duplicate
// launch quits before it can spawn a window, and focus the existing window instead.
// Skipped when unpackaged so electron-vite's dev restart and the (sometimes parallel)
// e2e launches aren't killed by the lock.
const hasInstanceLock = !app.isPackaged || app.requestSingleInstanceLock()
if (!hasInstanceLock) {
  // A duplicate launch — the first instance owns the lock and will focus its window.
  app.quit()
} else {
  app.on('second-instance', () => {
    const existing = BrowserWindow.getAllWindows().at(-1)
    if (!existing) return
    if (existing.isMinimized()) existing.restore()
    existing.focus()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // The duplicate instance has already called app.quit() above; never let its
  // whenReady boot a window or register the global handlers.
  if (!hasInstanceLock) return

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.fabiofiorita.porcelain')

  // Keep e2e fully off the user's screen — no Dock icon bounce either.
  if (isE2E) app.dock?.hide()

  // One global tRPC handler for every window (ipcMain.handle is process-wide).
  registerTrpcHandler()
  registerTerminalHandlers()
  installAppMenu()

  if (is.dev) {
    await seedDevConfig()
  }

  // Move any legacy notes, flow layers, and reviewed marks out of userData/config.json
  // into their ~/.porcelain agent channels so the MCP can read (and, for layers, write)
  // them. One-time + idempotent; runs before any window reads notes/layers/reviewed.
  await migrateNotesFromConfig()
  await migrateLayersFromConfig()
  await migrateReviewedFromConfig()

  // Watch the agent channels so MCP-pushed review sets / resolved comments refresh
  // the open views.
  await watchAgentChannels()

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

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Kill every spawned TS language server before exit (mirrors how a window kills its
// PTYs on close). These are per-repo children that outlive any single window, so
// they're torn down here at the process level rather than per-window.
app.on('will-quit', () => {
  shutdownAllLsp()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
