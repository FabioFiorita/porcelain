import { publicErrorSchema } from '@porcelain/contracts'
import { TRPCError } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { expectedFailure } from './expected-failure'
import { formatPublicError, normalizePublicError, toTrpcError } from './public-error'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'

describe('daemon public errors', () => {
  it('maps private expected failures to contract-valid errors and stable tRPC codes', () => {
    const stableCodes = [
      ['request.invalid', 'BAD_REQUEST'],
      ['auth.unauthenticated', 'UNAUTHORIZED'],
      ['auth.forbidden', 'FORBIDDEN'],
      ['resource.not-found', 'NOT_FOUND'],
      ['state.conflict', 'CONFLICT'],
      ['resource.unavailable', 'SERVICE_UNAVAILABLE'],
      ['internal.unexpected', 'INTERNAL_SERVER_ERROR'],
    ] as const

    for (const [code, trpcCode] of stableCodes) {
      expect(toTrpcError(expectedFailure(code)).code).toBe(trpcCode)
    }
    expect(
      toTrpcError(expectedFailure('protocol.update-required', { expected: 2, received: null }))
        .code,
    ).toBe('CONFLICT')

    const failure = expectedFailure('auth.forbidden')
    const normalized = normalizePublicError(toTrpcError(failure), REQUEST_ID)

    expect(Object.isFrozen(failure)).toBe(true)
    expect(normalized.unexpected).toBe(false)
    expect(publicErrorSchema.parse(normalized.error)).toEqual({
      code: 'auth.forbidden',
      category: 'forbidden',
      message: 'Access is forbidden.',
      retryable: false,
      requestId: REQUEST_ID,
    })
  })

  it('recognizes only tRPC Zod input failures as request.invalid', () => {
    const parsed = z.object({ label: z.string().min(1) }).safeParse({ label: '' })
    expect(parsed.success).toBe(false)
    if (parsed.success) throw new Error('Expected invalid input')

    const inputFailure = normalizePublicError(
      new TRPCError({ code: 'BAD_REQUEST', cause: parsed.error }),
      REQUEST_ID,
    )
    const rawBadRequest = normalizePublicError(
      new TRPCError({ code: 'BAD_REQUEST', cause: new Error('token=raw-secret') }),
      REQUEST_ID,
    )
    const forgedExpectedFailure = normalizePublicError({ code: 'auth.forbidden' }, REQUEST_ID)

    expect(inputFailure).toMatchObject({
      error: { code: 'request.invalid', requestId: REQUEST_ID },
      unexpected: false,
    })
    expect(rawBadRequest).toMatchObject({
      error: { code: 'internal.unexpected', requestId: REQUEST_ID },
      unexpected: true,
    })
    expect(forgedExpectedFailure).toMatchObject({
      error: { code: 'internal.unexpected', requestId: REQUEST_ID },
      unexpected: true,
    })
  })

  it('preserves the tRPC envelope while replacing unsafe diagnostics with data.porcelain', () => {
    const secret = 'token=secret path=/host/private content=never-send'
    const formatted = formatPublicError({
      error: new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: new Error(secret) }),
      ctx: { requestId: REQUEST_ID },
      shape: {
        message: secret,
        code: -32603,
        data: {
          code: 'INTERNAL_SERVER_ERROR',
          httpStatus: 500,
          path: 'renamePath',
          stack: secret,
        },
      },
    })

    expect(formatted).toMatchObject({
      message: 'An unexpected error occurred.',
      code: -32603,
      data: {
        code: 'INTERNAL_SERVER_ERROR',
        httpStatus: 500,
        path: 'renamePath',
        porcelain: { code: 'internal.unexpected', requestId: REQUEST_ID },
      },
    })
    expect(formatted.data).not.toHaveProperty('stack')
    expect(publicErrorSchema.parse(formatted.data.porcelain)).toMatchObject({
      code: 'internal.unexpected',
      requestId: REQUEST_ID,
    })
    expect(JSON.stringify(formatted)).not.toContain(secret)
  })
})
