import { publicErrorSchema } from '@porcelain/contracts'
import { describe, expect, it } from 'vitest'
import { normalizePublicError } from './daemon-composition/public-error'
import { adminProcedure, t } from './trpc'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

describe('daemon tRPC composition', () => {
  it('maps administrator middleware refusals through the expected-failure boundary', async () => {
    const router = t.router({ restricted: adminProcedure.query(() => 'ok') })
    const caller = router.createCaller({
      auth: { kind: 'client', clientId: 'client-1', label: 'Test phone' },
      requestId: REQUEST_ID,
    })

    const error = await rejected(() => caller.restricted())
    const normalized = normalizePublicError(error, REQUEST_ID)

    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
      code: 'auth.forbidden',
      requestId: REQUEST_ID,
    })
  })
})
