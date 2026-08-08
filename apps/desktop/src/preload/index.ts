import { electronAPI } from '@electron-toolkit/preload'
import { resolvePlatform } from '@shared/platform'
import { contextBridge, ipcRenderer } from 'electron'
import type { ShellEvent } from '../main/shell-events'
import type { PorcelainBridge } from './bridge'

// The daemon's base url + session token, fetched synchronously at window boot
// (the shell spawns the daemon before the first window, so both are known). A
// a daemon restart or environment-group route change pushes a fresh pair through
// `daemon.onUrlChanged` (see src/main/daemon.ts). The token gates every request — see the
// security note in backend/server.ts.
interface DaemonInfo {
  url: string
  token: string
}

function toDaemonInfo(value: unknown): DaemonInfo {
  if (value !== null && typeof value === 'object' && 'url' in value && 'token' in value) {
    const { url, token } = value
    if (typeof url === 'string' && typeof token === 'string') return { url, token }
  }
  return { url: '', token: '' }
}

const initialDaemon = toDaemonInfo(ipcRenderer.sendSync('daemon-url'))

const porcelain: PorcelainBridge = {
  trpcShell: (request: {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }): Promise<{ status: number; headers: Record<string, string>; body: string }> =>
    ipcRenderer.invoke('trpc-shell', request),
  onShellEvent: (callback: (event: ShellEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, event: ShellEvent): void => callback(event)
    ipcRenderer.on('shell-event', handler)
    return () => ipcRenderer.removeListener('shell-event', handler)
  },
  daemon: {
    url: initialDaemon.url,
    token: initialDaemon.token,
    onUrlChanged: (callback: (info: DaemonInfo) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: unknown): void =>
        callback(toDaemonInfo(info))
      ipcRenderer.on('daemon-url-changed', handler)
      return () => ipcRenderer.removeListener('daemon-url-changed', handler)
    },
  },
  // True only under the Playwright e2e harness (PORCELAIN_E2E). The terminal registry
  // reads this to install a buffer-scraping test hook the WebGL renderer otherwise
  // makes impossible (the canvas never fills `.Ghostty-rows`). Never set in real runs.
  e2e: process.env.PORCELAIN_E2E === '1',
  // The desktop OS the shell runs on — drives Ctrl-primary + Linux labels + the
  // opaque fallback surface in the renderer (lib/platform.ts `isLinuxShell`).
  platform: resolvePlatform(),
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
