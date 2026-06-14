import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import icon from '../../resources/icon.png?asset'
import { emitAppEvent } from './app-events'
import { seedDevConfig } from './dev-config'
import { isSafeExternalUrl } from './external-url'
import { pipeAppEvents, registerTrpcHandler } from './ipc'
import { watchReviewSets } from './review-watch'

// Dev gets its own config dir so `pnpm dev` never touches (or hijacks) the
// state of the installed app the user works in. Must run before anything
// reads userData (the config store is lazy, so before whenReady is enough).
if (is.dev) {
  app.setPath('userData', `${app.getPath('userData')}-dev`)
}

import { initUpdater } from './updater'

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
    // Center the traffic lights in the sidebar header. The header is h-12 (48px)
    // but the floating sidebar tile is inset 8px from the window top, so the
    // header's center sits at window-y 32 (8 + 24). The buttons' visual center is
    // ~y+8 (≈16px effective), so 32 − 8 = 24 centers them. GOTCHA: maximizing or
    // fullscreening the window resets this to the macOS default — Electron doesn't
    // re-apply trafficLightPosition on window state changes.
    trafficLightPosition: { x: 19, y: 24 },
    vibrancy: 'hud',
    visualEffectState: 'followWindow',
    backgroundColor: '#00000000',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  pipeAppEvents(mainWindow)

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
    mainWindow.show()
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

  // One global tRPC handler for every window (ipcMain.handle is process-wide).
  registerTrpcHandler()

  if (is.dev) {
    await seedDevConfig()
  }

  // Watch the agent channel so MCP-pushed review sets refresh the open feature view.
  await watchReviewSets()

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
