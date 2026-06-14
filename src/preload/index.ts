import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import type { AppEvent } from '../main/app-events'

// Our own type-safe transport over Electron IPC (replaces electron-trpc):
// `trpc` is request/response for queries + mutations, `onAppEvent` is the single
// main→renderer push channel. The renderer's matching types live in lib/trpc.ts.
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
