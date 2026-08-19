import { join } from 'node:path'
import { isSafeExternalUrl } from '@backend/fs/external-url'
import { is } from '@electron-toolkit/utils'
import { resolvePlatform } from '@shared/platform'
import { BrowserWindow, shell, type WebContents } from 'electron'
import icon from '../../resources/icon.png?asset'
import { getDefaultEnvironmentId, setWindowEnvironment } from './daemon'

// The opaque dark shell background: the `.dark --background` token from
// src/renderer/src/assets/main.css — oklch(0.148 0.004 228.8) → #090b0c. Set on
// the BrowserWindow so it never flashes white before the renderer's first paint.
// (Porcelain dropped vibrancy for an opaque design, so there's no transparent
// window to blend anymore.)
const OPAQUE_BACKGROUND = '#090b0c'

// Playwright e2e launches this built app and drives the renderer over CDP +
// screenshots the web contents directly, so the OS window never needs to appear.
// Gate test-only "stay hidden" behavior on this flag (set by the e2e fixture).
const isE2E = process.env.PORCELAIN_E2E === '1'

/**
 * Boot intent for a new window. `environmentId` is optional: omit to use the
 * app's default (last env this app opened a window into); pass `null` for This
 * device (local daemon); pass a saved remote id for that environment. Binding is
 * per-window — see setWindowEnvironment in daemon.ts.
 */
export type WindowInit =
  | { mode: 'restore'; environmentId?: string | null }
  | { mode: 'open'; repoPath: string; environmentId?: string | null }
  | { mode: 'welcome'; environmentId?: string | null }

const pendingInits = new Map<WebContents, WindowInit>()

// Returns the window's init (default { mode: 'restore' }). It is IDEMPOTENT —
// safe to call repeatedly, because the renderer's boot effect runs under React
// StrictMode (double-invoked in dev) and any remount/retry must read the same
// init. The pending entry is cleaned up when the window closes (the existing
// pendingInits.delete(webContents) in the createWindow 'closed' handler).
export function windowInitFor(sender: WebContents): WindowInit {
  return pendingInits.get(sender) ?? { mode: 'restore' }
}

/**
 * Replace the boot intent for an already-open window (e.g. after an environment
 * switch). Survives `webContents.reload()` the same way create-time init does —
 * cleaned up only when the window closes.
 */
function setWindowBootIntent(sender: WebContents, init: WindowInit): void {
  pendingInits.set(sender, init)
}

/**
 * Point THIS window at an environment and hard-reload it so the renderer boots cleanly
 * against the new daemon (new url/token via the preload sync getter). Lands on the
 * welcome page for that environment, or on `repoPath` when the caller names a checkout
 * that lives on it (a Hub click). Restoring the previous machine's path would open the
 * wrong disk, so only an explicit path is carried across. Main-process reload is deliberate: a renderer-side
 * `location.reload()` after invalidate can race or skip if the mutation onSuccess chain
 * fails, leaving shell chrome on one env and the appRouter on the other.
 */
export function switchWindowEnvironment(
  webContents: WebContents,
  environmentId: string | null,
  repoPath?: string,
): void {
  setWindowEnvironment(webContents, environmentId)
  setWindowBootIntent(
    webContents,
    // A Hub click names both the Environment and the checkout on it, so boot straight
    // into that path instead of the welcome page. Only a plain environment switch (no
    // path) lands on welcome — restoring the previous machine's path would open the
    // wrong disk.
    repoPath === undefined
      ? { mode: 'welcome', environmentId }
      : { mode: 'open', repoPath, environmentId },
  )
  if (!webContents.isDestroyed()) {
    webContents.reload()
  }
}

export function createWindow(init: WindowInit = { mode: 'restore' }): BrowserWindow {
  const platform = resolvePlatform()
  // Create the browser window. Chrome is platform-split: macOS keeps its native
  // traffic lights (hiddenInset + centered position); Linux/Windows are frameless
  // and the renderer draws its own controls (window-controls.tsx).
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: OPAQUE_BACKGROUND,
    ...(platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          // Center the traffic lights against the left sidebar header (there is no
          // drawn titlebar row on macOS — see title-bar.tsx). That header is h-12
          // (48px) but sits inside the floating sidebar's own 9px top padding
          // (app-sidebar.tsx `md:pt-[9px]`), so its content centers at window-y
          // 9 + 24 = 33. The buttons' visual center is ~y+8 (≈16px effective), so
          // 33 − 8 = 25 centers them. GOTCHA: maximizing or fullscreening the window
          // resets this to the macOS default — Electron doesn't re-apply
          // trafficLightPosition on window state changes.
          trafficLightPosition: { x: 19, y: 25 },
        }
      : {
          // Linux/Windows: no native window controls — the renderer draws the
          // min/maximize/close cluster, so the window is frameless.
          frame: false,
          icon,
        }),
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

  // Bind this window to its environment BEFORE loadURL so the preload's sync
  // daemon-url getter (sendSync) resolves the right pair on first paint.
  // Undefined environmentId → app default (persisted activeId); null → local.
  const environmentId =
    init.environmentId !== undefined ? init.environmentId : getDefaultEnvironmentId()
  setWindowEnvironment(mainWindow.webContents, environmentId)

  // A window's PTYs and watchers now live daemon-side, keyed by its WS session —
  // closing the window closes the socket and the daemon reaps them (session.ts).
  const { webContents } = mainWindow
  mainWindow.on('closed', () => {
    pendingInits.delete(webContents)
  })

  // The renderer's custom window controls (Linux/Windows frameless chrome) draw a
  // maximize-vs-restore glyph, so they need to know when the OS flips that state —
  // e.g. a double-click on a drag region or a window-manager shortcut, not just our
  // own toggle button. Window-targeted, mirroring the close-tab sender below.
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('shell-event', 'maximized-changed')
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('shell-event', 'maximized-changed')
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

  // Close-tab (Cmd/Ctrl+W → close the active tab, or the window when none is open) is
  // owned platform-split:
  //   - macOS: the main process intercepts Cmd+W here, because Electron delivers it to
  //     the OS default (close window) before the renderer sees it — main must
  //     preventDefault() and route it to the renderer via the shell-event channel.
  //   - Linux/Windows: NO intercept — the renderer owns Ctrl+W (use-app-shortcuts.ts).
  //     Letting the keydown reach the page is what lets a focused embedded terminal
  //     keep Ctrl+W as readline's kill-word; the renderer handler yields to the PTY.
  if (platform === 'darwin') {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (
        input.type === 'keyDown' &&
        input.meta &&
        input.key.toLowerCase() === 'w' &&
        !input.shift
      ) {
        event.preventDefault()
        mainWindow.webContents.send('shell-event', 'close-tab')
      }
    })
  }

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
