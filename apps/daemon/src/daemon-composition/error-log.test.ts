import { TRPCError } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { logUnexpectedError } from './error-log'

const REQUEST_ID = '00000000-0000-4000-8000-000000000099'

describe('unexpected error logging', () => {
  it('logs only correlation, procedure, and error type', () => {
    const secret = 'token=secret path=/host/private content=never-send'
    const cause = new Error(secret)
    cause.name = secret
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      logUnexpectedError({
        error: new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause }),
        requestId: REQUEST_ID,
        path: 'renamePath',
      })

      expect(log).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledWith({
        requestId: REQUEST_ID,
        path: 'renamePath',
        errorType: 'Error',
      })
      expect(JSON.stringify(log.mock.calls)).not.toContain(secret)
    } finally {
      log.mockRestore()
    }
  })
})
