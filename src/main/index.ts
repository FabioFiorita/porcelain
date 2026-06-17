import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import icon from '../../resources/icon.png?asset'
import { emitAppEvent } from './app-events'
import { seedDevConfig } from './dev-config'
import { isSafeExternalUrl } from './external-url'
import { pipeAppEvents, registerTerminalHandlers, registerTrpcHandler } from './ipc'
import { watchAgentChannels } from './review-watch'
import { killTerminalsForSender } from './terminal-manager'

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

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    // Center the traffic lights in the full-width window titlebar. It's h-12 (48px)
    // flush with the window top, so its center sits at window-y 24. The buttons'
    // visual center is ~y+8 (≈16px effective), so 24 − 8 = 16 centers them. GOTCHA:
    // maximizing or fullscreening the window resets this to the macOS default —
    // Electron doesn't re-apply trafficLightPosition on window state changes.
    trafficLightPosition: { x: 19, y: 16 },
    vibrancy: 'hud',
    visualEffectState: 'followWindow',
    backgroundColor: '#00000000',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // A never-shown e2e window would otherwise throttle rendering and blank
      // the screenshots; keep it painting.
      ...(isE2E ? { backgroundThrottling: false } : {}),
    },
  })

  pipeAppEvents(mainWindow)

  // A window's PTYs are tied to its WebContents — reap them when it closes so no
  // orphaned shell (or background dev server) outlives the window.
  const { webContents } = mainWindow
  mainWindow.on('closed', () => killTerminalsForSender(webContents))

  // Surface renderer-side errors in the dev terminal so failures are debuggable
  // without opening devtools (a blank window otherwise hides the cause).
  if (is.dev) {
    mainWindow.webContents.on('console-message', (event) => {
      console.log(`[renderer:${event.level}] ${event.message}`)
    })
  }
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[renderer gone] reason=${details.reason} exitCode=${details.exitCode}`)
  })

  // Cmd+W closes the active tab in the renderer, not the window; the renderer
  // calls window.close() itself when no tabs are open.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.meta && input.key.toLowerCase() === 'w' && !input.shift) {
      event.preventDefault()
      emitAppEvent('close-tab')
    }
  })

  mainWindow.on('ready-to-show', () => {
    // Under e2e the window stays hidden — Playwright drives the renderer and
    // screenshots the web contents; popping a real window would steal the screen.
    if (!isE2E) mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.fabiofiorita.porcelain')

  // Keep e2e fully off the user's screen — no Dock icon bounce either.
  if (isE2E) app.dock?.hide()

  // One global tRPC handler for every window (ipcMain.handle is process-wide).
  registerTrpcHandler()
  registerTerminalHandlers()

  if (is.dev) {
    await seedDevConfig()
  }

  // Watch the agent channels so MCP-pushed review sets / resolved comments refresh
  // the open views.
  await watchAgentChannels()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  initUpdater()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
