// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

// The Remote network procedures read and mutate real listeners, Tailscale Funnel, and the
// persisted config. This suite owns the contract boundary only, so every one of those seams is
// test-owned: nothing here starts a listener, shells out to Tailscale, or writes a config file.
const { configStore, funnel, listeners } = vi.hoisted(() => ({
  configStore: {
    loadConfig: vi.fn(async () => ({ tailnetBind: true, lanBind: false, funnelBind: false })),
    updateConfig: vi.fn(async () => undefined),
  },
  listeners: {
    tailnetUrl: vi.fn((): string | null => 'http://workstation.example:43118'),
    tailnetBindError: vi.fn((): 'in-use' | null => null),
    lanUrl: vi.fn((): string | null => 'http://workstation.local:43118'),
    lanNumericUrl: vi.fn((): string | null => 'http://192.168.1.10:43118'),
    lanBindError: vi.fn((): 'in-use' | null => null),
    ifaceListenerPort: vi.fn(() => 43118),
    startTailnetListener: vi.fn(async () => undefined),
    stopTailnetListener: vi.fn(async () => undefined),
    startLanListener: vi.fn(async () => undefined),
    stopLanListener: vi.fn(async () => undefined),
  },
  funnel: {
    funnelStatus: vi.fn(async () => ({
      enabled: false,
      url: null as string | null,
      managed: false,
      error: 'unavailable' as 'unavailable' | 'conflict' | null,
    })),
    startFunnel: vi.fn(async () => ({
      enabled: true,
      url: 'https://workstation.example.ts.net' as string | null,
      managed: true,
      error: null as 'unavailable' | 'conflict' | null,
    })),
    stopFunnel: vi.fn(async () => ({
      enabled: false,
      url: null as string | null,
      managed: false,
      error: null as 'unavailable' | 'conflict' | null,
    })),
  },
}))

vi.mock('../stores/config-store', () => configStore)
vi.mock('../net/tailnet-listener', () => listeners)
vi.mock('../net/funnel', () => funnel)

import { networkRouter } from './network'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'
const ADMIN_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const

function caller() {
  return networkRouter.createCaller(ADMIN_CONTEXT)
}

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: networkRouter,
    path,
    type,
    ctx: ADMIN_CONTEXT,
    getRawInput: async () => input,
    signal: undefined,
    batchIndex: 0,
  })
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

beforeEach(() => {
  vi.stubEnv('PORCELAIN_TAILNET_BIND', '')
  vi.stubEnv('PORCELAIN_LAN_BIND', '')
  vi.stubEnv('PORCELAIN_FUNNEL_BIND', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('network router contract boundary', () => {
  it('returns the canonical tailnet status for a valid query', async () => {
    expect(await caller().tailnetStatus()).toEqual({
      enabled: true,
      url: 'http://workstation.example:43118',
      error: null,
      envForced: false,
      port: 43118,
    })
  })

  it('returns the canonical LAN status after a valid bind mutation', async () => {
    expect(await caller().setLanBind(true)).toEqual({
      enabled: true,
      url: 'http://workstation.local:43118',
      numericUrl: 'http://192.168.1.10:43118',
      error: null,
      envForced: false,
      port: 43118,
    })
    expect(listeners.startLanListener).toHaveBeenCalledTimes(1)
    expect(listeners.stopLanListener).not.toHaveBeenCalled()
    expect(configStore.updateConfig).toHaveBeenCalledTimes(1)
  })

  it('rejects a value supplied to a no-input procedure as request.invalid', async () => {
    const error = await rejected(() => callWithRawInput('lanStatus', 'query', { enabled: true }))
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(listeners.lanUrl).not.toHaveBeenCalled()
  })

  it('rejects a non-boolean bind input as request.invalid without touching Funnel', async () => {
    const error = await rejected(() => callWithRawInput('setFunnelBind', 'mutation', 'on'))
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(funnel.startFunnel).not.toHaveBeenCalled()
    expect(funnel.stopFunnel).not.toHaveBeenCalled()
    expect(configStore.updateConfig).not.toHaveBeenCalled()
  })

  it('refuses to serialize a Funnel status that violates its output contract', async () => {
    funnel.funnelStatus.mockResolvedValueOnce({
      enabled: true,
      url: 'workstation.example.ts.net',
      managed: true,
      error: null,
    })

    const error = await rejected(() => caller().funnelStatus())
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(true)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'internal.unexpected',
      requestId: REQUEST_ID,
    })
  })
})
