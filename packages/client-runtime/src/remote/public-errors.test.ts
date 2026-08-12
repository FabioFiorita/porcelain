import { publicErrorFixtures } from '@porcelain/contracts'
import { sessionContractFixtures } from '@porcelain/contracts/session'
import { describe, expect, it } from 'vitest'
import { isRemoteRetryable, parsePublicError } from './public-errors'

const SYSTEM_CODES = [
  'request.invalid',
  'auth.unauthenticated',
  'auth.forbidden',
  'resource.not-found',
  'state.conflict',
  'resource.unavailable',
  'internal.unexpected',
  'protocol.update-required',
] as const

const TERMINAL_PUBLIC_CODES = ['auth.unauthenticated', 'auth.forbidden', 'request.invalid'] as const

describe('parsePublicError', () => {
  it('classifies every system fixture and a retryable domain fixture', () => {
    for (const code of SYSTEM_CODES) {
      const fixture = publicErrorFixtures[code]
      const parsed = parsePublicError(fixture)
      if (code === 'protocol.update-required') {
        expect(parsed).toEqual({ kind: 'update-required', error: fixture })
        expect(isRemoteRetryable(parsed)).toBe(false)
        continue
      }
      expect(parsed).toEqual({ kind: 'public', error: fixture })
      expect(isRemoteRetryable(parsed)).toBe(fixture.retryable)
    }

    const domainRetryable = publicErrorFixtures['board.unavailable']
    const parsed = parsePublicError(domainRetryable)
    expect(parsed).toEqual({ kind: 'public', error: domainRetryable })
    expect(isRemoteRetryable(parsed)).toBe(true)
  })

  it('reads protocol.update-required from a fixture, data.porcelain, and session:mismatch', () => {
    const fixture = publicErrorFixtures['protocol.update-required']
    expect(parsePublicError(fixture)).toEqual({ kind: 'update-required', error: fixture })
    expect(parsePublicError({ data: { porcelain: fixture } })).toEqual({
      kind: 'update-required',
      error: fixture,
    })
    expect(parsePublicError({ porcelain: fixture })).toEqual({
      kind: 'update-required',
      error: fixture,
    })

    const mismatch = parsePublicError(sessionContractFixtures.mismatch)
    expect(mismatch).toEqual({
      kind: 'update-required',
      error: {
        ...fixture,
        details: {
          expected: sessionContractFixtures.mismatch.expected,
          received: sessionContractFixtures.mismatch.received,
        },
      },
    })
    expect(isRemoteRetryable(mismatch)).toBe(false)
  })

  it('keeps auth and request.invalid public and not retryable', () => {
    for (const code of TERMINAL_PUBLIC_CODES) {
      const parsed = parsePublicError(publicErrorFixtures[code])
      expect(parsed).toEqual({ kind: 'public', error: publicErrorFixtures[code] })
      expect(isRemoteRetryable(parsed)).toBe(false)
    }
  })

  it('treats a missing envelope as unreachable and retryable', () => {
    expect(parsePublicError(undefined)).toEqual({ kind: 'unreachable' })
    expect(parsePublicError('UNAUTHORIZED')).toEqual({ kind: 'unreachable' })
    expect(parsePublicError(new TypeError('UNAUTHORIZED'))).toEqual({ kind: 'unreachable' })
    expect(
      parsePublicError({
        code: 'UNAUTHORIZED',
        httpStatus: 401,
        message: publicErrorFixtures['auth.unauthenticated'].message,
      }),
    ).toEqual({ kind: 'unreachable' })
    expect(isRemoteRetryable(parsePublicError('UNAUTHORIZED'))).toBe(true)
  })

  it('treats a malformed session:mismatch frame as unreachable', () => {
    const malformed = { t: 'session:mismatch' }
    expect(parsePublicError(malformed)).toEqual({ kind: 'unreachable' })
    expect(isRemoteRetryable(parsePublicError(malformed))).toBe(true)
  })

  it('does not take kind from a message field', () => {
    const bait = {
      ...publicErrorFixtures['auth.unauthenticated'],
      message: publicErrorFixtures['protocol.update-required'].message,
    }
    expect(parsePublicError(bait)).toEqual({ kind: 'public', error: bait })
    expect(parsePublicError(new TypeError(bait.message))).toEqual({ kind: 'unreachable' })
  })
})
