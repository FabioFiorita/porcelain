import { is } from '@electron-toolkit/utils'
import { Menu, type MenuItemConstructorOptions } from 'electron'
import { resolvePlatform } from '../shared/platform'
import { createWindow } from './window'

export function installAppMenu(): void {
  const isMac = resolvePlatform() === 'darwin'

  // dev-only items typed via an annotated const so the role strings stay
  // contextually typed (NO casts — 'as'/'as unknown as' are banned repo-wide).
  const devViewItems: MenuItemConstructorOptions[] = is.dev
    ? [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
      ]
    : []

  // Close (Cmd/Ctrl+W). WHY the accelerator is main-owned only on macOS: menu
  // accelerators fire in the main process before the renderer's keydown, so a
  // registered CmdOrCtrl+W here would close the WINDOW before the page sees the
  // key — killing the renderer's close-tab handler (use-app-shortcuts.ts) and, on
  // Linux, its yield of Ctrl+W to a focused embedded terminal (readline kill-word).
  //   - macOS: keep the native `{ role: 'close' }` — its Cmd+W is intercepted in
  //     window.ts (before-input-event) and routed to the renderer, so the menu
  //     accelerator never actually reaches the OS close. Behavior is unchanged.
  //   - Linux/Windows: NO intercept in window.ts, so the accelerator must NOT be
  //     registered — `registerAccelerator: false` (honored on Linux/Windows only)
  //     keeps the menu item but lets the Ctrl+W keydown fall through to the page.
  const closeItem: MenuItemConstructorOptions = isMac
    ? { role: 'close' }
    : { role: 'close', registerAccelerator: false }

  // Electron's `{ role: 'windowMenu' }` is expanded here so its platform default
  // Close item can't smuggle a registered Ctrl+W back in on Linux/Windows. macOS
  // keeps the native window roles (minimize/zoom/front); non-darwin omits Close
  // entirely — the renderer owns close-tab and the window manager still closes the
  // window — so no CmdOrCtrl+W accelerator is registered on this platform at all.
  const windowSubmenu: MenuItemConstructorOptions[] = isMac
    ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
    : [{ role: 'minimize' }, { role: 'zoom' }]

  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Alt+N',
          click: () => {
            createWindow({ mode: 'welcome' })
          },
        },
        { type: 'separator' },
        closeItem,
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        ...devViewItems,
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'window', submenu: windowSubmenu },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
