import type { IncomingMessage, ServerResponse } from 'node:http'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { publicErrorFor, writePublicError } from '../../daemon-composition/public-error'

/**
 * The wire-protocol gate, a sibling extraction to remote-origins.ts.
 *
 * The daemon serves independently updated clients and does not emulate older ones: both
 * dispatching routes require the exact protocol version this build speaks, and say so in a
 * typed 409 the client can act on.
 *
 * A protocol announcement is exactly one decimal integer — no sign, space, exponent,
 * fraction, or repeated header. Anything else announced no version this build can compare
 * against, so it is reported back as `received: null` rather than guessed into a number.
 */
const PROTOCOL_VERSION_PATTERN = /^(?:0|[1-9]\d*)$/

export function announcedProtocolVersion(req: IncomingMessage): number | null {
  const raw = req.headers[PROTOCOL_VERSION_HEADER]
  if (typeof raw !== 'string' || !PROTOCOL_VERSION_PATTERN.test(raw)) return null
  const announced = Number(raw)
  return Number.isSafeInteger(announced) ? announced : null
}

/** True when the request announced the wrong protocol — the 409 has already been written. */
export function rejectProtocolMismatch(
  req: IncomingMessage,
  res: ServerResponse,
  cors: Record<string, string>,
  requestId: string,
): boolean {
  const received = announcedProtocolVersion(req)
  if (received === PROTOCOL_VERSION) return false
  writePublicError(
    res,
    409,
    cors,
    publicErrorFor('protocol.update-required', requestId, {
      expected: PROTOCOL_VERSION,
      received,
    }),
  )
  return true
}
