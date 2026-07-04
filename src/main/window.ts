import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { BrowserWindow, shell, type WebContents } from 'electron'
import icon from '../../resources/icon.png?asset'
import { isSafeExternalUrl } from './external-url'
import { clearWatchedDirs, clearWatchedFiles } from './file-watch'
import { pipeAppEvents } from './ipc'
import { killTerminalsForSender } from './terminal-manager'

// Playwright e2e launches this built app and drives the renderer over CDP +
// screenshots the web contents directly, so the OS window never needs to appear.
// Gate test-only "stay hidden" behavior on this flag (set by the e2e fixture).
const isE2E = process.env.PORCELAIN_E2E === '1'

export type WindowInit =
  | { mode: 'restore' }
  | { mode: 'open'; repoPath: string }
  | { mode: 'welcome' }

const pendingInits = new Map<WebContents, WindowInit>()

// Returns the window's init (default { mode: 'restore' }). It is IDEMPOTENT —
// safe to call repeatedly, because the renderer's boot effect runs under React
// StrictMode (double-invoked in dev) and any remount/retry must read the same
// init. The pending entry is cleaned up when the window closes (the existing
// pendingInits.delete(webContents) in the createWindow 'closed' handler).
export function windowInitFor(sender: WebContents): WindowInit {
  return pendingInits.get(sender) ?? { mode: 'restore' }
}

export function createWindow(init: WindowInit = { mode: 'restore' }): BrowserWindow {
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
      // Deliberate: the preload imports Node builtins, so the sandbox is off; isolation
      // is set explicitly so a future Electron default change can't weaken the boundary.
      contextIsolation: true,
      sandbox: false,
      // A never-shown e2e window would otherwise throttle rendering and blank
      // the screenshots; keep it painting.
      ...(isE2E ? { backgroundThrottling: false } : {}),
    },
  })

  pendingInits.set(mainWindow.webContents, init)

  pipeAppEvents(mainWindow)

  // A window's PTYs are tied to its WebContents — reap them when it closes so no
  // orphaned shell (or background dev server) outlives the window.
  const { webContents } = mainWindow
  mainWindow.on('closed', () => {
    killTerminalsForSender(webContents)
    clearWatchedFiles(webContents)
    clearWatchedDirs(webContents)
    pendingInits.delete(webContents)
  })

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
      mainWindow.webContents.send('app-event', 'close-tab')
    }
  })

  mainWindow.on('ready-to-show', () => {
    // Under e2e the window stays hidden — Playwright drives the renderer and
    // screenshots the web contents; popping a real window would steal the screen.
    if (!isE2E) mainWindow.show()
  })

  // Single external-URL gate: every path that could open a URL in the OS goes
  // through isSafeExternalUrl so the allowlist lives in exactly one place.
  const openIfSafe = (url: string): void => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url)
    }
  }

  // Gate window.open / target=_blank navigations.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    openIfSafe(details.url)
    return { action: 'deny' }
  })

  // Gate top-level navigations of the app frame (bare <a href>, location=, form
  // posts). The app frame must never navigate away from its own renderer; allow only
  // the dev HMR origin and hand any safe external URL to the OS opener.
  const guardNavigation = (details: { preventDefault(): void; url: string }): void => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (is.dev && devUrl && details.url.startsWith(devUrl)) return
    details.preventDefault()
    openIfSafe(details.url)
  }
  mainWindow.webContents.on('will-navigate', guardNavigation)
  // will-redirect covers top-level redirects, which some Electron versions don't
  // surface through will-navigate.
  mainWindow.webContents.on('will-redirect', guardNavigation)

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
