import { electronAPI } from '@electron-toolkit/preload'
import { resolvePlatform } from '@shared/platform'
import { contextBridge, ipcRenderer } from 'electron'
import type { ShellEvent } from '../main/shell-events'
import {
  type DaemonInfo,
  daemonInfoSchema,
  type PorcelainBridge,
  type TrpcShellRequest,
  type TrpcShellResponse,
  trpcShellResponseSchema,
} from './bridge'

// The daemon's base url + session token, fetched synchronously at window boot
// (the shell spawns the daemon before the first window, so both are known). A
// a daemon restart or environment-group route change pushes a fresh pair through
// `daemon.onUrlChanged` (see src/main/daemon.ts). The token gates every request — see the
// security note in backend/server.ts.
//
// Fail closed: a foreign shape is a main/preload contract break, not a legitimate empty
// pair. Boot throws so the bridge never exposes fabricated url/token; change events log
// and drop the payload rather than inventing one for the callback.
function parseDaemonInfo(value: unknown): DaemonInfo {
  return daemonInfoSchema.parse(value)
}

const initialDaemon = parseDaemonInfo(ipcRenderer.sendSync('daemon-url'))

const porcelain: PorcelainBridge = {
  // The reply crosses back from main as `unknown`; parse it here, where trust changes,
  // so the renderer's fetch shim can build a Response without re-checking anything.
  trpcShell: async (request: TrpcShellRequest): Promise<TrpcShellResponse> => {
    const reply: unknown = await ipcRenderer.invoke('trpc-shell', request)
    const parsed = trpcShellResponseSchema.safeParse(reply)
    if (!parsed.success) {
      throw new Error('shell router returned a malformed response')
    }
    return parsed.data
  },
  onShellEvent: (callback: (event: ShellEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, event: ShellEvent): void => callback(event)
    ipcRenderer.on('shell-event', handler)
    return () => ipcRenderer.removeListener('shell-event', handler)
  },
  daemon: {
    url: initialDaemon.url,
    token: initialDaemon.token,
    onUrlChanged: (callback: (info: DaemonInfo) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: unknown): void => {
        const parsed = daemonInfoSchema.safeParse(info)
        if (!parsed.success) {
          console.error('daemon-url-changed payload is not daemon info', parsed.error)
          return
        }
        callback(parsed.data)
      }
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
  window.electron = electronAPI
  window.porcelain = porcelain
}
