import type { ProtocolVersion } from '@porcelain/contracts'
import {
  type SessionMismatchFrame,
  type SessionReadyFrame,
  sessionHelloFrameSchema,
} from '@porcelain/contracts/session'
import { z } from 'zod'

/**
 * The daemon's session handshake: one pure decision from a client's opening frame to the
 * reply that frame has earned. A session that does not match this build's protocol is
 * refused here, before it can register interests or receive a single change notification.
 *
 * Transport-neutral on purpose — no socket, no I/O, no timers. It takes the frame exactly
 * as `JSON.parse` produced it, so the decision can be table-tested without opening a
 * connection, and so the same rule can back any future session transport.
 *
 * Integration point for `RT-002` (session gateway): after the upgrade has authenticated the
 * connection, parse the first frame's JSON, call `decideSessionHandshake` with this build's
 * `PROTOCOL_VERSION` and the daemon instance epoch, and send the returned frame. On
 * `mismatch` the gateway sends the frame and closes the socket without creating watches,
 * streams, or a publisher registration; only `ready` opens the session. Matching clients
 * pay exactly one round trip: hello in, ready out.
 *
 * Obligations this places on `RT-004` (Web) and `RT-005` (mobile): send `session:hello`
 * as the first frame, treat `session:mismatch` as a terminal update-required outcome rather
 * than a reconnect trigger, and attribute every later `sequence` to the epoch carried by
 * `session:ready`.
 */

/** What the daemon owes the client after reading its opening frame. */
export type SessionHandshakeDecision =
  | { outcome: 'ready'; frame: SessionReadyFrame }
  | { outcome: 'mismatch'; frame: SessionMismatchFrame }

export type SessionHandshakeInput = {
  /** The opening frame as parsed JSON — untrusted, never pre-validated by the caller. */
  frame: unknown
  /** The protocol this build speaks; the gateway passes `PROTOCOL_VERSION`. */
  daemonProtocolVersion: ProtocolVersion
  /** This daemon instance's epoch, which every later `sequence` is attributed to. */
  epoch: string
}

/**
 * Reads the version a client *claims* without requiring it to be one this build accepts.
 *
 * The hello schema pins `protocolVersion` to this build's literal, so a client on another
 * protocol fails it — and a failed parse carries no data to report back. The mismatch reply
 * owes that client a `received` value, so the raw announcement is read here, off the same
 * unvalidated JSON, before the strict parse decides the outcome. Anything that is not a
 * non-negative integer (absent, a string, fractional, negative, not even an object) is not a
 * protocol version at all and is reported as `null`.
 */
const announcedProtocolVersionSchema = z.object({
  protocolVersion: z.number().int().nonnegative(),
})

function readAnnouncedProtocolVersion(frame: unknown): SessionMismatchFrame['received'] {
  const announced = announcedProtocolVersionSchema.safeParse(frame)
  return announced.success ? announced.data.protocolVersion : null
}

/**
 * Accepts only a structurally valid hello announcing this build's protocol; every other
 * opening frame — wrong version, missing or malformed version, unknown field, not a hello at
 * all — is refused with the mismatch frame and its stable public error code.
 *
 * The version comparison lives in `sessionHelloFrameSchema` itself: its `protocolVersion` is
 * the literal this build speaks, so a successful parse *is* the match. Nothing here compares
 * app releases, and no mismatch is ever downgraded into a ready.
 */
export function decideSessionHandshake({
  frame,
  daemonProtocolVersion,
  epoch,
}: SessionHandshakeInput): SessionHandshakeDecision {
  if (sessionHelloFrameSchema.safeParse(frame).success) {
    return {
      outcome: 'ready',
      frame: { t: 'session:ready', protocolVersion: daemonProtocolVersion, epoch },
    }
  }
  return {
    outcome: 'mismatch',
    frame: {
      t: 'session:mismatch',
      code: 'protocol.update-required',
      expected: daemonProtocolVersion,
      received: readAnnouncedProtocolVersion(frame),
    },
  }
}
