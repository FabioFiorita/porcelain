import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PorcelainBridge } from './bridge'

/**
 * The preload is the far side of the shuttle: whatever main resolves comes back through
 * `ipcRenderer.invoke` as `unknown`. Parsing here — not in the renderer — is what lets
 * `lib/trpc.ts` build a `Response` out of the reply without re-checking a thing.
 */

const invoke = vi.fn()
const sendSync = vi.fn()
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
    on: vi.fn(),
    removeListener: vi.fn(),
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
  method: 'POST',
  headers: {},
  body: '{"0":{}}',
}

async function loadBridge(daemonUrlReply: unknown): Promise<PorcelainBridge> {
  exposed.clear()
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
})

describe('preload trpcShell', () => {
  it('returns a well-formed shuttle response unchanged', async () => {
    const bridge = await loadBridge({ url: 'http://127.0.0.1:43118', token: 'pc_admin' })
    invoke.mockResolvedValue(VALID_RESPONSE)

    await expect(bridge.trpcShell(REQUEST)).resolves.toEqual(VALID_RESPONSE)
    expect(invoke).toHaveBeenCalledWith('trpc-shell', REQUEST)
  })

  it('rejects a malformed shuttle response instead of handing it to the renderer', async () => {
    const bridge = await loadBridge({ url: '', token: '' })
    const malformed: unknown[] = [
      undefined,
      null,
      'ok',
      { ...VALID_RESPONSE, status: '200' },
      { ...VALID_RESPONSE, status: 200.5 },
      { ...VALID_RESPONSE, body: 42 },
      { ...VALID_RESPONSE, headers: { 'content-length': 12 } },
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

  it('falls back to the empty pair when main answers with a foreign shape', async () => {
    for (const reply of [undefined, null, 'http://127.0.0.1:43118', { url: 1, token: 2 }, {}]) {
      const bridge = await loadBridge(reply)
      expect({ url: bridge.daemon.url, token: bridge.daemon.token }).toEqual({ url: '', token: '' })
    }
  })
})
