import { type PorcelainError, publicErrorFixtures, publicErrorSchema } from '@porcelain/contracts'
import { sessionMismatchFrameSchema } from '@porcelain/contracts/session'

export type RemotePublicErrorParse =
  | { readonly kind: 'public'; readonly error: PorcelainError }
  | {
      readonly kind: 'update-required'
      readonly error: PorcelainError
    }
  | { readonly kind: 'unreachable' }

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  return value as Record<string, unknown>
}

function porcelainCandidate(value: unknown): unknown {
  const record = asRecord(value)
  if (record === undefined) return value
  if (Object.hasOwn(record, 'porcelain')) return record.porcelain
  const data = asRecord(record.data)
  if (data !== undefined && Object.hasOwn(data, 'porcelain')) return data.porcelain
  return value
}

export function parsePublicError(value: unknown): RemotePublicErrorParse {
  const record = asRecord(value)
  if (record !== undefined && record.t === 'session:mismatch') {
    const mismatch = sessionMismatchFrameSchema.safeParse(value)
    if (mismatch.success) {
      return {
        kind: 'update-required',
        error: publicErrorSchema.parse({
          ...publicErrorFixtures['protocol.update-required'],
          details: { expected: mismatch.data.expected, received: mismatch.data.received },
        }),
      }
    }
  }

  const parsed = publicErrorSchema.safeParse(porcelainCandidate(value))
  if (!parsed.success) return { kind: 'unreachable' }
  if (parsed.data.code === 'protocol.update-required') {
    return { kind: 'update-required', error: parsed.data }
  }
  return { kind: 'public', error: parsed.data }
}

export function isRemoteRetryable(parsed: RemotePublicErrorParse): boolean {
  if (parsed.kind === 'unreachable') return true
  if (parsed.kind === 'update-required') return false
  return parsed.error.retryable
}
