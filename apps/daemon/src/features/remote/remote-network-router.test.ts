// @vitest-environment node
import { PROTOCOL_VERSION, publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import { createRemoteNetworkRouter } from './remote-network-router'
import type { RemoteOperations } from './remote-operations'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'
const ADMIN_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }

const TAILNET = {
  enabled: true,
  url: 'http://workstation.example:43118',
  error: null,
  envForced: false,
  port: 43118,
} as const

const LAN = {
  enabled: true,
  url: 'http://workstation.local:43118',
  numericUrl: 'http://192.168.1.10:43118',
  error: null,
  envForced: false,
  port: 43118,
} as const

const CLOUDFLARE = {
  enabled: false,
  url: null,
  managed: false,
  error: 'unavailable' as const,
  envForced: false,
}

const operations = {
  daemonInfo: vi.fn<RemoteOperations['daemonInfo']>(() => ({
    version: '0.52.1',
    protocolVersion: PROTOCOL_VERSION,
    host: 'workstation',
    platform: 'linux',
    arch: 'x64',
  })),
  accessStatus: vi.fn<RemoteOperations['accessStatus']>(async () => ({
    pairings: [],
    clients: [],
    connected: 0,
    adminTokenPath: '~/.porcelain/admin-token',
  })),
  issuePairingLink: vi.fn<RemoteOperations['issuePairingLink']>(async () => ({
    ok: true as const,
    value: {
      id: 'pairing-id',
      label: 'Test phone',
      createdAt: '2026-08-09T12:00:00.000Z',
      expiresAt: '2026-08-09T12:15:00.000Z',
      credential: 'pc_pair_pairing-id_secret',
      url: 'https://porcelain.example/pair#token=pc_pair_pairing-id_secret',
    },
  })),
  revokePairingLink: vi.fn<RemoteOperations['revokePairingLink']>(async () => ({
    ok: true as const,
    value: undefined,
  })),
  revokeAuthorizedClient: vi.fn<RemoteOperations['revokeAuthorizedClient']>(async () => ({
    ok: true as const,
    value: undefined,
  })),
  revokeCurrentClient: vi.fn<RemoteOperations['revokeCurrentClient']>(async () => ({
    ok: true as const,
    value: undefined,
  })),
  tailnetStatus: vi.fn<RemoteOperations['tailnetStatus']>(async () => TAILNET),
  setTailnetBind: vi.fn<RemoteOperations['setTailnetBind']>(async () => TAILNET),
  lanStatus: vi.fn<RemoteOperations['lanStatus']>(async () => LAN),
  setLanBind: vi.fn<RemoteOperations['setLanBind']>(async () => LAN),
  cloudflareStatus: vi.fn<RemoteOperations['cloudflareStatus']>(async () => CLOUDFLARE),
  setCloudflareBind: vi.fn<RemoteOperations['setCloudflareBind']>(async () => CLOUDFLARE),
} satisfies RemoteOperations

const router = createRemoteNetworkRouter(operations)

function caller() {
  return router.createCaller(ADMIN_CONTEXT)
}

async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router,
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
  vi.clearAllMocks()
  vi.mocked(operations.tailnetStatus).mockResolvedValue(TAILNET)
  vi.mocked(operations.setTailnetBind).mockResolvedValue(TAILNET)
  vi.mocked(operations.lanStatus).mockResolvedValue(LAN)
  vi.mocked(operations.setLanBind).mockResolvedValue(LAN)
  vi.mocked(operations.cloudflareStatus).mockResolvedValue(CLOUDFLARE)
  vi.mocked(operations.setCloudflareBind).mockResolvedValue(CLOUDFLARE)
})

describe('Remote network router contract boundary', () => {
  it('returns the canonical tailnet status for a valid query', async () => {
    expect(await caller().tailnetStatus()).toEqual(TAILNET)
    expect(operations.tailnetStatus).toHaveBeenCalledOnce()
  })

  it('forwards setLanBind(true) to exactly one operation', async () => {
    expect(await caller().setLanBind(true)).toEqual(LAN)
    expect(operations.setLanBind).toHaveBeenCalledOnce()
    expect(operations.setLanBind).toHaveBeenCalledWith(true)
    expect(operations.lanStatus).not.toHaveBeenCalled()
    expect(operations.setTailnetBind).not.toHaveBeenCalled()
    expect(operations.setCloudflareBind).not.toHaveBeenCalled()
  })

  it('rejects a value supplied to a no-input procedure as request.invalid', async () => {
    const error = await rejected(() => callWithRawInput('lanStatus', 'query', { enabled: true }))
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(operations.lanStatus).not.toHaveBeenCalled()
  })

  it('rejects a non-boolean bind input as request.invalid without calling the operation', async () => {
    const error = await rejected(() => callWithRawInput('setCloudflareBind', 'mutation', 'on'))
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(operations.setCloudflareBind).not.toHaveBeenCalled()
  })

  it('refuses to serialize a Cloudflare status that violates its output contract', async () => {
    vi.mocked(operations.cloudflareStatus).mockResolvedValueOnce({
      enabled: true,
      url: 'workstation.example.ts.net',
      managed: true,
      error: null,
      envForced: false,
    })

    const error = await rejected(() => caller().cloudflareStatus())
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(true)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'internal.unexpected',
      requestId: REQUEST_ID,
    })
  })
})
