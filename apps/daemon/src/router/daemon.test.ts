import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'
import { daemonRouter } from './daemon'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'
const ADMIN_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: daemonRouter,
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

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('daemon router contract boundary', () => {
  it('returns the canonical daemon identity for a valid query', async () => {
    vi.stubEnv('PORCELAIN_DAEMON_HOST', 'workstation')
    const caller = daemonRouter.createCaller(ADMIN_CONTEXT)

    expect(await caller.daemonInfo()).toEqual({
      version: expect.any(String),
      host: 'workstation',
      platform: process.platform,
      arch: process.arch,
    })
  })

  it('rejects an unknown key on a strict object input as request.invalid', async () => {
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
  })

  it('rejects a value supplied to a no-input procedure as request.invalid', async () => {
    for (const [path, type] of [
      ['accessStatus', 'query'],
      ['revokeCurrentClient', 'mutation'],
    ] as const) {
      const error = await rejected(() => callWithRawInput(path, type, 'unexpected'))
      const normalized = normalizePublicError(error, REQUEST_ID)

      expect(normalized.unexpected).toBe(false)
      expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
        code: 'request.invalid',
        requestId: REQUEST_ID,
      })
    }
  })
})

describe('daemon router expected failures', () => {
  it('maps every invalid pairing endpoint refusal to request.invalid', async () => {
    const caller = daemonRouter.createCaller({ auth: { kind: 'admin' }, requestId: REQUEST_ID })

    for (const baseUrl of [
      'ftp://example.com',
      'https://user:secret@example.com',
      'https://example.com/?token=secret',
      'https://example.com/#secret',
    ]) {
      const error = await rejected(() => caller.issuePairingLink({ label: 'Test phone', baseUrl }))
      const normalized = normalizePublicError(error, REQUEST_ID)

      expect(normalized.unexpected).toBe(false)
      expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
        code: 'request.invalid',
        requestId: REQUEST_ID,
      })
    }
  })

  it('maps administrator revocation to auth.forbidden', async () => {
    const caller = daemonRouter.createCaller({ auth: { kind: 'admin' }, requestId: REQUEST_ID })
    const error = await rejected(() => caller.revokeCurrentClient())
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'auth.forbidden',
      requestId: REQUEST_ID,
    })
  })
})
