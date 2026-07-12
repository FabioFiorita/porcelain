import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, type Session, session } from 'electron'
import { ensureMcpServer } from './agent-mcp'
import { startDaemon } from './daemon'
import { registerTrpcHandler } from './ipc'
import { installAppMenu } from './menu'
import { initUpdater } from './updater'
import { createWindow } from './window'

// Dev gets its own config dir so `pnpm dev` never touches (or hijacks) the
// state of the installed app the user works in. Must run before the daemon
// spawn (which passes app.getPath('userData') down as PORCELAIN_USER_DATA —
// the daemon owns the config store now, the shell never reads it).
if (is.dev) {
  app.setPath('userData', `${app.getPath('userData')}-dev`)
}

// Porcelain is ONE process hosting N windows (File → New Window / ⌘⌥N add windows
// *within* it), so a second OS instance is always a bug: it would boot its own
// createWindow({ mode: 'restore' }) and a duplicate window pops up "on its own" when
// something relaunches the binary. Hold a single-instance lock — a duplicate launch
// fails it, quits before whenReady can spawn a window, and the holder focuses an
// existing window via 'second-instance' instead. The lock only stops a second
// PROCESS; multi-window is untouched.
//
// This MUST run after the is.dev setPath above: the lock is scoped to userData, and
// that scoping is exactly what keeps things isolated — `pnpm dev` (…-dev userData)
// never contends with the packaged app, and each Playwright e2e instance (its own
// --user-data-dir → its own …-dev userData) holds a DISTINCT lock, so parallel e2e
// launches all acquire it and none quit. No isPackaged/env gate needed — the prior
// band-aid gated on !app.isPackaged, leaving the lock live only in the one build dev
// and e2e never exercise, so it shipped untested and quit the first packaged instance.
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

  // Spawn the daemon (the Electron-free backend: appRouter over HTTP, terminal/
  // watch/app-events over the WS session) before the first window so the preload's
  // sync daemon-url getter has a port to hand out. Config seeding, the agent-channel
  // migrations, and the channel watchers all run daemon-side now (backend/server.ts).
  try {
    await startDaemon()
  } catch (error) {
    // The window still opens; daemon.ts keeps retrying with backoff and pushes
    // the url over `daemon-url-changed` once a spawn succeeds.
    console.error('[daemon] initial start failed:', error)
  }

  // Refresh the bundled MCP server the user's agents point at. Agents run
  // `node ~/.porcelain/mcp/server.js` — a STABLE path baked into their config
  // once via Settings → Agents → MCP. Re-copying it from the app bundle on every
  // boot means an app update ships new/fixed tools transparently, with no need to
  // re-run "Add MCP". Best-effort: a failure here never blocks the window.
  try {
    await ensureMcpServer()
  } catch (error) {
    console.error('[mcp] server refresh failed:', error)
  }

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
