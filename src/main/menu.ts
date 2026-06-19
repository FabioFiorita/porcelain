import { is } from '@electron-toolkit/utils'
import { Menu, type MenuItemConstructorOptions } from 'electron'
import { createWindow } from './window'

export function installAppMenu(): void {
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
        { role: 'close' },
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
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
