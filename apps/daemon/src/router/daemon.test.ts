import { publicErrorSchema } from '@porcelain/contracts'
import { describe, expect, it } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'
import { daemonRouter } from './daemon'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

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
