import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { BrowserWindow, screen, type WebContents } from 'electron'
import { setWindowEnvironment } from './daemon'
import { popoverPosition, type Rect } from './popover-position'

/**
 * The menu-bar quick-add popover: a small frameless window that hosts the SAME web
 * client as every other Porcelain window, loaded at the `#/quick-add` surface. It is a
 * client like all the others — it creates the Task through `createTask` on the daemon,
 * never by touching disk.
 *
 * Two deliberate choices:
 *   - It is ALWAYS bound to This device (`setWindowEnvironment(wc, null)`). A popover
 *     you summon from the menu bar has no visible environment switcher, so inheriting
 *     the app default could file a Task on a remote machine without saying so.
 *   - It is DESTROYED on dismiss rather than hidden. A hidden window still counts for
 *     `window-all-closed`, which is what keeps the app alive after the last real window
 *     closes on Linux/Windows — a tray popover must not change that lifecycle.
 */

const POPOVER_WIDTH = 400
const POPOVER_HEIGHT = 300

// Same opaque shell background as window.ts, so the popover never flashes white.
const OPAQUE_BACKGROUND = '#090b0c'

// Playwright drives the renderer over CDP; a popover that shows itself would steal the
// screen, and one that hides on blur would destroy itself the moment it opens hidden.
const isE2E = process.env.PORCELAIN_E2E === '1'

let popover: BrowserWindow | null = null

/** Dismiss the popover if it is open. Safe to call when it is not. */
export function closeQuickAdd(): void {
  const open = popover
  popover = null
  if (open !== null && !open.isDestroyed()) open.destroy()
}

/** Dismiss only when the asking window IS the popover (the renderer's "created it" path). */
export function closeQuickAddFrom(sender: WebContents): void {
  if (popover === null || popover.isDestroyed()) return
  if (popover.webContents.id !== sender.id) return
  closeQuickAdd()
}

function popoverBounds(trayBounds: Rect | null): { x: number; y: number } {
  const size = { width: POPOVER_WIDTH, height: POPOVER_HEIGHT }
  const anchorPoint =
    trayBounds === null || (trayBounds.width === 0 && trayBounds.height === 0)
      ? screen.getCursorScreenPoint()
      : { x: Math.round(trayBounds.x + trayBounds.width / 2), y: Math.round(trayBounds.y) }
  const { workArea } = screen.getDisplayNearestPoint(anchorPoint)
  return popoverPosition({ tray: trayBounds, workArea, size })
}

function createQuickAddWindow(trayBounds: Rect | null): BrowserWindow {
  const { x, y } = popoverBounds(trayBounds)
  const window = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: OPAQUE_BACKGROUND,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      ...(isE2E ? { backgroundThrottling: false } : {}),
    },
  })

  // Before loadURL: the preload's sync `daemon-url` getter resolves the pair at boot.
  setWindowEnvironment(window.webContents, null)

  window.on('closed', () => {
    if (popover === window) popover = null
  })

  // Menu-bar popovers dismiss when they lose focus. Devtools steal focus, so a dev
  // debugging the popover would otherwise never see it stay open.
  if (!isE2E) {
    window.on('blur', () => {
      if (window.webContents.isDevToolsOpened()) return
      closeQuickAdd()
    })
  }

  window.on('ready-to-show', () => {
    if (!isE2E) {
      window.show()
      window.focus()
    }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/quick-add`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/quick-add' })
  }

  return window
}

/**
 * Menu-bar click semantics: open the popover under the tray icon, or dismiss it when it
 * is already up. `trayBounds` is null when the caller has no icon rectangle to offer
 * (the app menu item, or a Linux status-notifier tray that reports zeroes).
 */
export function toggleQuickAdd(trayBounds: Rect | null): void {
  if (popover !== null && !popover.isDestroyed()) {
    closeQuickAdd()
    return
  }
  popover = createQuickAddWindow(trayBounds)
}
