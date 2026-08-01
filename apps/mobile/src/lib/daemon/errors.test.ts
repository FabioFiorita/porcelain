import { TRPCClientError } from '@trpc/client'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { DaemonError, toDaemonError } from './errors'

function trpcError(data: { httpStatus?: number; code?: string } | null): TRPCClientError<never> {
  return TRPCClientError.from({
    error: { code: -32001, message: 'boom', data },
  })
}

describe('toDaemonError', () => {
  it('keeps a DaemonError it is handed', () => {
    const original = new DaemonError('unsupported', 'daemonInfo', 'too old')

    expect(toDaemonError('daemonInfo', original)).toBe(original)
  })

  it('reads a zod failure as version skew in the payload', () => {
    const failure = z.object({ version: z.string() }).safeParse({})

    expect(toDaemonError('daemonInfo', failure.error).kind).toBe('invalid-response')
  })

  it('reads a network failure as unreachable', () => {
    expect(toDaemonError('recentRepos', new TypeError('Network request failed')).kind).toBe(
      'unreachable',
    )
  })

  it('reads a 401 as unauthorized', () => {
    expect(
      toDaemonError('recentRepos', trpcError({ httpStatus: 401, code: 'UNAUTHORIZED' })).kind,
    ).toBe('unauthorized')
  })

  // A daemon too old to have the procedure answers NOT_FOUND — skew, not a broken connection.
  it('reads a 404 NOT_FOUND as unsupported', () => {
    expect(
      toDaemonError('daemonInfo', trpcError({ httpStatus: 404, code: 'NOT_FOUND' })).kind,
    ).toBe('unsupported')
  })

  it('reads a real daemon error as daemon-error', () => {
    expect(
      toDaemonError('openRepoPath', trpcError({ httpStatus: 500, code: 'INTERNAL_SERVER_ERROR' }))
        .kind,
    ).toBe('daemon-error')
  })

  it('reads a tRPC error with no data as unreachable', () => {
    expect(toDaemonError('openRepoPath', trpcError(null)).kind).toBe('unreachable')
  })
})
