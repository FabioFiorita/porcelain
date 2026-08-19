import { readFileSync } from 'node:fs'
import { resolvePlatform } from '@shared/platform'
import {
  app,
  BrowserWindow,
  Menu,
  type MenuItemConstructorOptions,
  nativeImage,
  Tray,
} from 'electron'
import trayLinuxIcon from '../../resources/tray-linux.png?asset'
import trayTemplateIcon from '../../resources/trayTemplate.png?asset'
import trayTemplateIcon2x from '../../resources/trayTemplate@2x.png?asset'
import { toggleQuickAdd } from './quick-add-window'
import { createWindow } from './window'

/**
 * The menu-bar (system tray) entry point: an icon that opens the quick-add popover.
 *
 * Platform split, because the tray is the least portable Electron surface there is:
 *   - macOS/Windows report the icon's screen rectangle and deliver a `click` event, so
 *     left-click toggles the popover and right-click pops the menu.
 *   - Linux hosts the icon through StatusNotifier (GNOME AppIndicator), which delivers NO
 *     click event and reports an all-zero rectangle — the only interaction there is the
 *     context menu, so Quick Add is its first item.
 */

// Module-level on purpose: a Tray that goes out of scope is garbage-collected and the
// icon silently disappears from the menu bar.
let tray: Tray | null = null

/**
 * macOS wants a template image (black + alpha; the OS tints it for light/dark menu bars
 * and for the highlighted state). The `Template` filename suffix only auto-applies when
 * Electron loads the file by path, and the packaged build rewrites asset paths, so the
 * flag is set explicitly and the @2x representation is attached by hand.
 */
function trayImage(): Electron.NativeImage {
  // Linux gets a plain light icon (no template tinting): `createFromPath` picks up the
  // `@2x` sibling on HiDPI displays by itself.
  if (resolvePlatform() === 'linux') return nativeImage.createFromPath(trayLinuxIcon)
  const image = nativeImage.createFromPath(trayTemplateIcon)
  image.addRepresentation({
    scaleFactor: 2,
    dataURL: `data:image/png;base64,${readFileSync(trayTemplateIcon2x).toString('base64')}`,
  })
  image.setTemplateImage(true)
  return image
}

/** Raise an existing Porcelain window, or open one when they are all closed. */
function openPorcelain(): void {
  const existing = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed())
  if (existing === undefined) {
    createWindow({ mode: 'restore' })
    return
  }
  if (existing.isMinimized()) existing.restore()
  existing.show()
  existing.focus()
}

/** Open (or dismiss) the quick-add popover anchored to the tray icon. */
export function toggleQuickAddPopover(): void {
  toggleQuickAdd(tray === null || tray.isDestroyed() ? null : tray.getBounds())
}

function trayMenu(): Menu {
  const items: MenuItemConstructorOptions[] = [
    { label: 'Quick Add Task…', click: toggleQuickAddPopover },
    { type: 'separator' },
    { label: 'Open Porcelain', click: openPorcelain },
    { type: 'separator' },
    { label: 'Quit Porcelain', role: 'quit' },
  ]
  return Menu.buildFromTemplate(items)
}

/** Install the menu-bar icon. Idempotent — a second call keeps the first tray. */
export function installTray(): void {
  if (tray !== null && !tray.isDestroyed()) return
  tray = new Tray(trayImage())
  tray.setToolTip('Porcelain — quick add a Task')

  const menu = trayMenu()
  if (resolvePlatform() === 'linux') {
    // No click event exists here; the context menu IS the interaction.
    tray.setContextMenu(menu)
    return
  }
  // Never `setContextMenu` on macOS: it makes a LEFT click open the menu, which would
  // take the one-click path to quick add away.
  tray.on('click', toggleQuickAddPopover)
  tray.on('right-click', () => {
    tray?.popUpContextMenu(menu)
  })
}

// Explicitly released before quit: an Electron Tray outliving the app keeps a ghost icon
// in the menu bar on some Linux shells.
app.on('before-quit', () => {
  if (tray !== null && !tray.isDestroyed()) tray.destroy()
  tray = null
})
