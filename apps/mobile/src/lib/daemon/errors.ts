import { TRPCClientError } from '@trpc/client'
import { z } from 'zod'

/** The failures a phone can act on at the daemon boundary. */
export type DaemonErrorKind = 'unreachable' | 'unauthorized' | 'invalid-response' | 'daemon-error'

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

/** Transport details belong in logs; screens get one sentence they can act on. */
export function daemonErrorMessage(error: DaemonError): string {
  switch (error.kind) {
    case 'unreachable':
      return 'The daemon could not be reached.'
    case 'unauthorized':
      return 'This device is no longer paired.'
    case 'invalid-response':
      return 'The daemon returned an invalid response.'
    case 'daemon-error':
      return 'The daemon could not complete that request.'
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
    return new DaemonError('unreachable', procedure, daemonErrorMessageFor('unreachable'), {
      cause,
    })
  }

  const data = errorDataSchema.safeParse(cause.data)
  const httpStatus = data.success ? data.data.httpStatus : undefined
  const code = data.success ? data.data.code : undefined
  if (httpStatus === 401 || httpStatus === 403 || code === 'UNAUTHORIZED') {
    return new DaemonError('unauthorized', procedure, 'This device is no longer paired.', { cause })
  }
  // No data at all means the request never reached a tRPC handler: DNS, refused, timeout.
  if (!data.success || code === undefined) {
    return new DaemonError('unreachable', procedure, daemonErrorMessageFor('unreachable'), {
      cause,
    })
  }
  return new DaemonError('daemon-error', procedure, daemonErrorMessageFor('daemon-error'), {
    cause,
  })
}

function daemonErrorMessageFor(kind: DaemonErrorKind): string {
  switch (kind) {
    case 'unreachable':
      return 'The daemon could not be reached.'
    case 'unauthorized':
      return 'This device is no longer paired.'
    case 'invalid-response':
      return 'The daemon returned an invalid response.'
    case 'daemon-error':
      return 'The daemon could not complete that request.'
  }
}
