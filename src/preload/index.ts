import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import type { ShellEvent } from '../main/shell-events'
import { resolvePlatform } from '../shared/platform'

// The daemon's base url + session token, fetched synchronously at window boot
// (the shell spawns the daemon before the first window, so both are known). A
// daemon restart lands on a NEW port; `daemon.onUrlChanged` pushes the fresh
// pair (see src/main/daemon.ts). The token gates every daemon request — see the
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

// The Electron bridge after the daemon split: `trpcShell` is the surviving
// request/response shuttle for the SHELL router only (the appRouter is real HTTP
// to the daemon now — see renderer lib/trpc.ts), `onShellEvent` is the tiny
// shell-side push channel (close-tab, update-status), and `daemon` hands the
// renderer the daemon's url. The terminal and app-event channels moved to the
// daemon's WS session (renderer lib/daemon.ts).
const porcelain = {
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
  // makes impossible (the canvas never fills `.xterm-rows`). Never set in real runs.
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
