// @vitest-environment node
import { PROTOCOL_VERSION, procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import * as liveSession from '../../session/live-session'
import type { RemoteOperations } from './remote-operations'
import { createRemoteRouter } from './remote-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'
const ADMIN_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const INFO = {
  version: '0.52.1',
  protocolVersion: PROTOCOL_VERSION,
  host: 'workstation',
  platform: 'linux',
  arch: 'x64',
} as const
const GRANT = {
  id: 'pairing-id',
  label: 'Test phone',
  createdAt: '2026-08-09T12:00:00.000Z',
  expiresAt: '2026-08-09T12:15:00.000Z',
  credential: 'pc_pair_pairing-id_secret',
  url: 'https://porcelain.example/pair#token=pc_pair_pairing-id_secret',
}

const operations: RemoteOperations = {
  daemonInfo: vi.fn(() => INFO),
  accessStatus: vi.fn(async () => ({
    pairings: [],
    clients: [],
    connected: 0,
    adminTokenPath: '~/.porcelain/admin-token',
  })),
  issuePairingLink: vi.fn(async () => ({ ok: true as const, value: GRANT })),
  revokePairingLink: vi.fn(async () => ({ ok: true as const, value: undefined })),
  revokeAuthorizedClient: vi.fn(async () => ({ ok: true as const, value: undefined })),
  revokeCurrentClient: vi.fn(async (auth) =>
    auth.kind === 'client'
      ? { ok: true as const, value: undefined }
      : { ok: false as const, error: { code: 'auth.forbidden' as const } },
  ),
  tailnetStatus: vi.fn(async () => ({
    enabled: false,
    url: null,
    error: null,
    envForced: false,
    port: 43117,
  })),
  setTailnetBind: vi.fn(async () => ({
    enabled: false,
    url: null,
    error: null,
    envForced: false,
    port: 43117,
  })),
  lanStatus: vi.fn(async () => ({
    enabled: false,
    url: null,
    numericUrl: null,
    error: null,
    envForced: false,
    port: 43117,
  })),
  setLanBind: vi.fn(async () => ({
    enabled: false,
    url: null,
    numericUrl: null,
    error: null,
    envForced: false,
    port: 43117,
  })),
  funnelStatus: vi.fn(async () => ({
    enabled: false,
    url: null,
    managed: false,
    error: 'unavailable' as const,
    envForced: false,
  })),
  setFunnelBind: vi.fn(async () => ({
    enabled: false,
    url: null,
    managed: false,
    error: 'unavailable' as const,
    envForced: false,
  })),
}

const router = createRemoteRouter(operations)

function caller(ctx = ADMIN_CONTEXT) {
  return router.createCaller(ctx)
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
  vi.mocked(operations.daemonInfo).mockReturnValue(INFO)
  vi.mocked(operations.accessStatus).mockResolvedValue({
    pairings: [],
    clients: [],
    connected: 0,
    adminTokenPath: '~/.porcelain/admin-token',
  })
  vi.mocked(operations.issuePairingLink).mockResolvedValue({ ok: true, value: GRANT })
  vi.mocked(operations.revokePairingLink).mockResolvedValue({ ok: true, value: undefined })
  vi.mocked(operations.revokeAuthorizedClient).mockResolvedValue({ ok: true, value: undefined })
  vi.mocked(operations.revokeCurrentClient).mockImplementation(async (auth) =>
    auth.kind === 'client'
      ? { ok: true, value: undefined }
      : { ok: false, error: { code: 'auth.forbidden' } },
  )
})

describe('Remote router contract boundary', () => {
  it('returns the stubbed daemon identity and shared protocol literal', async () => {
    const info = await caller().daemonInfo()

    expect(info).toEqual(INFO)
    expect(info.protocolVersion).toBe(1)
    expect(info.protocolVersion).not.toBe(info.version)
    expect(procedureCatalog.daemonInfo.output.safeParse(info).success).toBe(true)
    expect(operations.daemonInfo).toHaveBeenCalledOnce()
  })

  it('rejects an unknown key on a strict object input before the operation', async () => {
    const error = await rejected(() =>
      callWithRawInput('issuePairingLink', 'mutation', {
        label: 'Test phone',
        baseUrl: 'https://porcelain.example',
        expiresAt: '2026-08-09T12:15:00.000Z',
      }),
    )
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'request.invalid',
      requestId: REQUEST_ID,
    })
    expect(operations.issuePairingLink).not.toHaveBeenCalled()
  })

  it('rejects a value supplied to a no-input procedure before the operation', async () => {
    for (const [path, type, operation] of [
      ['accessStatus', 'query', operations.accessStatus],
      ['revokeCurrentClient', 'mutation', operations.revokeCurrentClient],
    ] as const) {
      const error = await rejected(() => callWithRawInput(path, type, 'unexpected'))
      const normalized = normalizePublicError(error, REQUEST_ID)

      expect(normalized.unexpected).toBe(false)
      expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
        code: 'request.invalid',
        requestId: REQUEST_ID,
      })
      expect(operation).not.toHaveBeenCalled()
    }
  })
})

describe('Remote router expected failures', () => {
  it('maps pairing URL-policy refusals to request.invalid', async () => {
    vi.mocked(operations.issuePairingLink).mockResolvedValue({
      ok: false,
      error: { code: 'request.invalid' },
    })

    for (const baseUrl of [
      'ftp://example.com',
      'https://user:secret@example.com',
      'https://example.com/?token=secret',
      'https://example.com/#secret',
    ]) {
      const error = await rejected(() =>
        caller().issuePairingLink({ label: 'Test phone', baseUrl }),
      )
      const normalized = normalizePublicError(error, REQUEST_ID)

      expect(normalized.unexpected).toBe(false)
      expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
        code: 'request.invalid',
        requestId: REQUEST_ID,
      })
    }
    expect(operations.issuePairingLink).toHaveBeenCalledTimes(4)
  })

  it('maps administrator revocation to auth.forbidden', async () => {
    const error = await rejected(() => caller().revokeCurrentClient())
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'auth.forbidden',
      requestId: REQUEST_ID,
    })
    expect(operations.revokeCurrentClient).toHaveBeenCalledWith(ADMIN_CONTEXT.auth)
  })

  it('does not close sessions from the router', async () => {
    const close = vi.spyOn(liveSession, 'closeClientSessions')

    await caller().revokeAuthorizedClient('client-id')

    expect(operations.revokeAuthorizedClient).toHaveBeenCalledWith('client-id')
    expect(close).not.toHaveBeenCalled()
    close.mockRestore()
  })
})
