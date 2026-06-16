import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import type { AppEvent } from '../main/app-events'

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
