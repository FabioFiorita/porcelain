import { is } from '@electron-toolkit/utils'
import { resolvePlatform } from '@shared/platform'
import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { createWindow } from './window'

export function installAppMenu(): void {
  const isMac = resolvePlatform() === 'darwin'

  // dev-only items typed via an annotated const so the role strings stay
  // contextually typed (NO casts — 'as'/'as unknown as' are banned in lint-escapes scan roots).
  const devViewItems: MenuItemConstructorOptions[] = is.dev
    ? [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
      ]
    : []

  // Close (Cmd/Ctrl+W). Menu accelerators fire in the main process before the
  // renderer's keydown, so a registered CmdOrCtrl+W here would close the WINDOW before
  // the page sees the key — killing the renderer's close-tab handler
  // (use-app-shortcuts.ts) and, on Linux, its yield of Ctrl+W to a focused embedded
  // terminal (readline kill-word). macOS keeps the native `{ role: 'close' }` because
  // window.ts intercepts Cmd+W (before-input-event) and routes it to the renderer;
  // Linux/Windows have no such intercept, so the accelerator must NOT be registered.
  const closeItem: MenuItemConstructorOptions = isMac
    ? { role: 'close' }
    : { role: 'close', registerAccelerator: false }

  // New Terminal (Cmd/Ctrl+T). Same trap as Close: a registered accelerator fires in
  // the main process before the renderer sees the key, regardless of what's focused.
  // On Linux/Windows the renderer deliberately yields Ctrl+T to a focused embedded
  // terminal (use-app-shortcuts.ts, ctrlIsPrimary) so the shell keeps its own
  // transpose-char binding — a registered accelerator here would steal that
  // unconditionally. macOS has no such carve-out (Cmd is free in the terminal), so it
  // keeps the real accelerator; Linux/Windows show the same shortcut label but let the
  // renderer's own keydown handler decide.
  const newTerminalItem: MenuItemConstructorOptions = {
    label: 'New Terminal',
    accelerator: 'CmdOrCtrl+T',
    ...(isMac ? {} : { registerAccelerator: false }),
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send('shell-event', 'new-terminal')
    },
  }

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
        newTerminalItem,
        { type: 'separator' },
        {
          label: 'Quick Open…',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('shell-event', 'quick-open')
          },
        },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('shell-event', 'open-settings')
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
        {
          label: 'Split Pane',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('shell-event', 'split-pane')
          },
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'window', submenu: windowSubmenu },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
