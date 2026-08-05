import { TRPCClientError } from '@trpc/client'
import { z } from 'zod'

/** The failures a phone can act on at the daemon boundary. */
export type DaemonErrorKind = 'unreachable' | 'unauthorized' | 'invalid-response' | 'daemon-error'

export class DaemonError extends Error {
  readonly kind: DaemonErrorKind
  readonly procedure: string
  /**
   * The daemon's own words, when it had any worth showing.
   *
   * Only set for `daemon-error` — the case where a handler ran and refused on purpose, so the
   * text is git's stderr or a written-for-a-human sentence ("README.md already exists"). The
   * transport kinds have nothing to add: a DNS failure's message describes a socket, not
   * anything the reader can act on.
   */
  readonly detail?: string

  constructor(
    kind: DaemonErrorKind,
    procedure: string,
    message: string,
    options?: { cause?: unknown; detail?: string },
  ) {
    super(message, options)
    this.name = 'DaemonError'
    this.kind = kind
    this.procedure = procedure
    this.detail = options?.detail
  }
}

/**
 * What a screen shows. Transport details belong in logs, so those collapse to one sentence the
 * reader can act on — but a refusal the daemon explained is passed through verbatim. Replacing
 * "! [rejected] main -> main (non-fast-forward)" with "could not complete that request" throws
 * away the only part that tells the user what to do next.
 */
export function daemonErrorMessage(error: DaemonError): string {
  return error.detail ?? daemonErrorMessageFor(error.kind)
}

/** The daemon wraps its cause; a bare tRPC message is already the sentence we want. */
function daemonErrorDetail(cause: TRPCClientError<never>): string | undefined {
  const text = cause.message.trim()
  if (text === '') return undefined
  // A stack that rode along in `message` is noise on a phone; keep the first paragraph.
  const [head] = text.split('\n    at ')
  return head.length > DETAIL_MAX ? `${head.slice(0, DETAIL_MAX).trimEnd()}…` : head
}

const DETAIL_MAX = 600

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
    detail: daemonErrorDetail(cause),
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
