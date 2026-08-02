import { TRPCClientError } from '@trpc/client'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { DaemonError, daemonErrorMessage, toDaemonError } from './errors'

function trpcError(data: { httpStatus?: number; code?: string } | null): TRPCClientError<never> {
  return TRPCClientError.from({
    error: { code: -32001, message: 'boom', data },
  })
}

describe('toDaemonError', () => {
  it('keeps a DaemonError it is handed', () => {
    const original = new DaemonError('daemon-error', 'daemonInfo', 'failed')

    expect(toDaemonError('daemonInfo', original)).toBe(original)
  })

  it('reads a zod failure as an invalid response', () => {
    const failure = z.object({ version: z.string() }).safeParse({})

    expect(toDaemonError('daemonInfo', failure.error).kind).toBe('invalid-response')
  })

  it('reads a network failure as unreachable', () => {
    const error = toDaemonError('recentRepos', new TypeError('Promise.swift:56'))
    expect(error.kind).toBe('unreachable')
    expect(error.message).toBe('The daemon could not be reached.')
    expect(daemonErrorMessage(error)).toBe('The daemon could not be reached.')
  })

  it('reads a 401 as unauthorized', () => {
    expect(
      toDaemonError('recentRepos', trpcError({ httpStatus: 401, code: 'UNAUTHORIZED' })).kind,
    ).toBe('unauthorized')
  })

  it('reads a 404 NOT_FOUND as a daemon error', () => {
    expect(
      toDaemonError('daemonInfo', trpcError({ httpStatus: 404, code: 'NOT_FOUND' })).kind,
    ).toBe('daemon-error')
  })

  it('reads a real daemon error as daemon-error', () => {
    expect(
      toDaemonError('openRepoPath', trpcError({ httpStatus: 500, code: 'INTERNAL_SERVER_ERROR' }))
        .kind,
    ).toBe('daemon-error')
  })

  it('reads a tRPC error with no data as unreachable', () => {
    const error = toDaemonError('openRepoPath', trpcError(null))
    expect(error.kind).toBe('unreachable')
    expect(error.message).toBe('The daemon could not be reached.')
  })
})
