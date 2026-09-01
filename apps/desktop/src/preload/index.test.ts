import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PorcelainBridge } from './bridge'

/**
 * The preload is the far side of the shuttle: whatever main resolves comes back through
 * `ipcRenderer.invoke` as `unknown`. Parsing here — not in the renderer — is what lets
 * `lib/trpc.ts` build a `Response` out of the reply without re-checking a thing.
 */

const invoke = vi.fn()
const sendSync = vi.fn()
const on = vi.fn()
const removeListener = vi.fn()
const exposed = new Map<string, unknown>()

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, value: unknown): void => {
      exposed.set(key, value)
    },
  },
  ipcRenderer: {
    invoke: (...args: unknown[]) => invoke(...args),
    sendSync: (...args: unknown[]) => sendSync(...args),
    on: (...args: unknown[]) => on(...args),
    removeListener: (...args: unknown[]) => removeListener(...args),
  },
}))

vi.mock('@electron-toolkit/preload', () => ({ electronAPI: {} }))

const VALID_RESPONSE = {
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: '{"result":{"data":null}}',
}

const REQUEST = {
  url: 'http://localhost/trpc-shell/windowInit',
  method: 'POST' as const,
  headers: {},
  body: '{"0":{}}',
}

async function loadBridge(daemonUrlReply: unknown): Promise<PorcelainBridge> {
  exposed.clear()
  on.mockReset()
  removeListener.mockReset()
  sendSync.mockReturnValue(daemonUrlReply)
  Object.defineProperty(process, 'contextIsolated', { value: true, configurable: true })
  vi.resetModules()
  await import('./index')
  const bridge = exposed.get('porcelain')
  if (bridge === undefined) throw new Error('the preload exposed no porcelain bridge')
  return bridge as PorcelainBridge
}

beforeEach(() => {
  invoke.mockReset()
  sendSync.mockReset()
  on.mockReset()
  removeListener.mockReset()
})

describe('preload trpcShell', () => {
  it('returns a well-formed shuttle response unchanged', async () => {
    const bridge = await loadBridge({ url: 'http://127.0.0.1:43118', token: 'pc_admin' })
    invoke.mockResolvedValue(VALID_RESPONSE)

    await expect(bridge.trpcShell(REQUEST)).resolves.toEqual(VALID_RESPONSE)
    expect(invoke).toHaveBeenCalledWith('trpc-shell', REQUEST)
  })

  it('rejects a malformed shuttle response instead of handing it to the renderer', async () => {
    const bridge = await loadBridge({ url: 'http://127.0.0.1:43118', token: 'pc_admin' })
    const malformed: unknown[] = [
      undefined,
      null,
      'ok',
      { ...VALID_RESPONSE, status: '200' },
      { ...VALID_RESPONSE, status: 200.5 },
      { ...VALID_RESPONSE, status: 99 },
      { ...VALID_RESPONSE, status: 600 },
      { ...VALID_RESPONSE, body: 42 },
      { ...VALID_RESPONSE, headers: { 'content-length': 12 } },
      { ...VALID_RESPONSE, headers: { 'bad name': 'x' } },
      { status: 200, headers: {} },
      { ...VALID_RESPONSE, extra: true },
    ]

    for (const reply of malformed) {
      invoke.mockResolvedValueOnce(reply)
      await expect(bridge.trpcShell(REQUEST)).rejects.toThrow(
        'shell router returned a malformed response',
      )
    }
  })
})

describe('preload daemon info', () => {
  it('carries a well-formed pair through to the renderer', async () => {
    const bridge = await loadBridge({ url: 'http://127.0.0.1:43118', token: 'pc_admin' })
    expect(bridge.daemon.url).toBe('http://127.0.0.1:43118')
    expect(bridge.daemon.token).toBe('pc_admin')
  })

  it('fails closed at boot when main answers with a foreign shape', async () => {
    for (const reply of [
      undefined,
      null,
      'http://127.0.0.1:43118',
      { url: 1, token: 2 },
      { url: '', token: '' },
      { url: 'file:///Applications/Porcelain.app', token: 'pc_admin' },
      { url: 'http://127.0.0.1:43118', token: '' },
      {},
    ]) {
      exposed.clear()
      sendSync.mockReturnValue(reply)
      Object.defineProperty(process, 'contextIsolated', { value: true, configurable: true })
      vi.resetModules()
      await expect(import('./index')).rejects.toThrow()
      expect(exposed.get('porcelain')).toBeUndefined()
    }
  })

  it('never invokes onUrlChanged with fabricated data for a foreign change event', async () => {
    const bridge = await loadBridge({ url: 'http://127.0.0.1:43118', token: 'pc_admin' })
    const callback = vi.fn()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    bridge.daemon.onUrlChanged(callback)

    const handler = on.mock.calls.find((call) => call[0] === 'daemon-url-changed')?.[1] as
      | ((event: unknown, info: unknown) => void)
      | undefined
    if (handler === undefined) throw new Error('daemon-url-changed listener was never registered')

    for (const info of [undefined, null, 'http://x', { url: 1, token: 2 }, { token: 'only' }]) {
      handler({}, info)
    }

    expect(callback).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalled()

    // A later valid event still reaches the callback — only foreign shapes are dropped.
    handler({}, { url: 'http://127.0.0.1:43119', token: 'pc_next' })
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith({ url: 'http://127.0.0.1:43119', token: 'pc_next' })

    error.mockRestore()
  })
})
