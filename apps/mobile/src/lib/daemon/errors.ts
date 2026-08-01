import { TRPCClientError } from '@trpc/client'
import { z } from 'zod'

/**
 * The five failures a phone actually sees. `unsupported` is version skew, not a bug: a daemon
 * older than the procedure answers `NOT_FOUND`, and the calling screen degrades instead of
 * claiming the connection is broken.
 */
export type DaemonErrorKind =
  | 'unreachable'
  | 'unauthorized'
  | 'unsupported'
  | 'invalid-response'
  | 'daemon-error'

export class DaemonError extends Error {
  readonly kind: DaemonErrorKind
  readonly procedure: string

  constructor(
    kind: DaemonErrorKind,
    procedure: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'DaemonError'
    this.kind = kind
    this.procedure = procedure
  }
}

/** tRPC's error payload, read structurally — the shape the daemon's `errorFormatter` sends. */
const errorDataSchema = z.object({
  httpStatus: z.number().optional(),
  code: z.string().optional(),
})

export function toDaemonError(procedure: string, cause: unknown): DaemonError {
  if (cause instanceof DaemonError) return cause
  if (cause instanceof z.ZodError) {
    return new DaemonError('invalid-response', procedure, 'Unexpected response from the daemon.', {
      cause,
    })
  }
  if (!(cause instanceof TRPCClientError)) {
    const message = cause instanceof Error ? cause.message : 'The daemon could not be reached.'
    return new DaemonError('unreachable', procedure, message, { cause })
  }

  const data = errorDataSchema.safeParse(cause.data)
  const httpStatus = data.success ? data.data.httpStatus : undefined
  const code = data.success ? data.data.code : undefined
  if (httpStatus === 401 || httpStatus === 403 || code === 'UNAUTHORIZED') {
    return new DaemonError('unauthorized', procedure, 'This device is no longer paired.', { cause })
  }
  if (code === 'NOT_FOUND' && httpStatus === 404) {
    return new DaemonError('unsupported', procedure, 'Your daemon is too old for this.', { cause })
  }
  // No data at all means the request never reached a tRPC handler: DNS, refused, timeout.
  if (!data.success || code === undefined) {
    return new DaemonError('unreachable', procedure, cause.message, { cause })
  }
  return new DaemonError('daemon-error', procedure, cause.message, { cause })
}
