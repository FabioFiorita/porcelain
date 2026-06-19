import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import type { AppEvent } from '../main/app-events'

// The effective platform — Linux/Windows have no macOS traffic lights, so the
// renderer renders its own window controls and an opaque void. PORCELAIN_FORCE_LINUX
// previews the Linux chrome on any OS (used by `PORCELAIN_FORCE_LINUX=1 pnpm dev`).
function effectivePlatform(): 'darwin' | 'linux' | 'win32' {
  if (process.env.PORCELAIN_FORCE_LINUX === '1') return 'linux'
  if (process.platform === 'darwin') return 'darwin'
  if (process.platform === 'win32') return 'win32'
  return 'linux'
}

// Our own type-safe transport over Electron IPC (replaces electron-trpc):
// `trpc` is request/response for queries + mutations, `onAppEvent` is the single
// main→renderer push channel, and `terminal` is a SECOND dedicated channel — a
// bidirectional byte stream for the embedded terminal (PTY output out, keystrokes
// in), which the request/response transport can't carry. The renderer's matching
// types live in lib/trpc.ts.
const porcelain = {
  trpc: (request: {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }): Promise<{ status: number; headers: Record<string, string>; body: string }> =>
    ipcRenderer.invoke('trpc', request),
  onAppEvent: (callback: (event: AppEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, event: AppEvent): void => callback(event)
    ipcRenderer.on('app-event', handler)
    return () => ipcRenderer.removeListener('app-event', handler)
  },
  terminal: {
    create: (opts: {
      cwd: string
      initialInput?: string
      cols?: number
      rows?: number
    }): Promise<string> => ipcRenderer.invoke('terminal:create', opts),
    write: (id: string, data: string): void => ipcRenderer.send('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number): void =>
      ipcRenderer.send('terminal:resize', id, cols, rows),
    kill: (id: string): void => ipcRenderer.send('terminal:kill', id),
    onData: (callback: (id: string, data: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, data: string): void =>
        callback(id, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback: (id: string, exitCode: number) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, exitCode: number): void =>
        callback(id, exitCode)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },
  },
  // True only under the Playwright e2e harness (PORCELAIN_E2E). The terminal registry
  // reads this to install a buffer-scraping test hook the WebGL renderer otherwise
  // makes impossible (the canvas never fills `.xterm-rows`). Never set in real runs.
  e2e: process.env.PORCELAIN_E2E === '1',
  // The effective platform; the renderer tags <html> with it and branches its chrome.
  platform: effectivePlatform(),
  // Window controls for platforms without native traffic lights (Linux/Windows).
  // The renderer's WindowControls drives these; the main process owns the BrowserWindow.
  windowControls: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('window:toggle-maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChange: (callback: (isMaximized: boolean) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean): void =>
        callback(isMaximized)
      ipcRenderer.on('window:maximized-changed', handler)
      return () => ipcRenderer.removeListener('window:maximized-changed', handler)
    },
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('porcelain', porcelain)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.porcelain = porcelain
}
