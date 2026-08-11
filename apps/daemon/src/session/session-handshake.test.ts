import { PROTOCOL_VERSION } from '@porcelain/contracts'
import {
  sessionContractFixtures,
  sessionMismatchFrameSchema,
  sessionReadyFrameSchema,
} from '@porcelain/contracts/session'
import { describe, expect, it } from 'vitest'
import { decideSessionHandshake } from './session-handshake'

const EPOCH = 'synthetic-epoch'

function decide(frame: unknown) {
  return decideSessionHandshake({
    frame,
    daemonProtocolVersion: PROTOCOL_VERSION,
    epoch: EPOCH,
  })
}

describe('Session handshake decision', () => {
  it('answers a hello on this build protocol with a ready carrying the epoch', () => {
    const decision = decide(sessionContractFixtures.hello)

    expect(decision.outcome).toBe('ready')
    expect(decision.frame).toEqual({
      t: 'session:ready',
      protocolVersion: PROTOCOL_VERSION,
      epoch: EPOCH,
    })
    expect(sessionReadyFrameSchema.parse(decision.frame)).toEqual(decision.frame)
  })

  it('accepts the hello frame the client contract actually sends', () => {
    expect(decide(JSON.parse(JSON.stringify(sessionContractFixtures.hello))).outcome).toBe('ready')
  })

  // `received` is what the client announced, not what the daemon accepts: an older or newer
  // protocol is reported verbatim, and anything that is not a version at all reports null.
  const refused: ReadonlyArray<{ name: string; frame: unknown; received: number | null }> = [
    {
      name: 'an older protocol version',
      frame: { t: 'session:hello', protocolVersion: PROTOCOL_VERSION - 1 },
      received: PROTOCOL_VERSION - 1,
    },
    {
      name: 'a newer protocol version',
      frame: { t: 'session:hello', protocolVersion: PROTOCOL_VERSION + 1 },
      received: PROTOCOL_VERSION + 1,
    },
    {
      name: 'a far future protocol version',
      frame: { t: 'session:hello', protocolVersion: 99 },
      received: 99,
    },
    { name: 'no protocol version at all', frame: { t: 'session:hello' }, received: null },
    {
      name: 'a stringified protocol version',
      frame: { t: 'session:hello', protocolVersion: String(PROTOCOL_VERSION) },
      received: null,
    },
    {
      name: 'a fractional protocol version',
      frame: { t: 'session:hello', protocolVersion: 1.5 },
      received: null,
    },
    {
      name: 'a negative protocol version',
      frame: { t: 'session:hello', protocolVersion: -1 },
      received: null,
    },
    {
      name: 'a null protocol version',
      frame: { t: 'session:hello', protocolVersion: null },
      received: null,
    },
    // A structurally invalid hello is refused even when its version reads correctly: an
    // unknown field means the client is not speaking this frame, whatever it claims.
    {
      name: 'an unknown field beside a correct version',
      frame: { ...sessionContractFixtures.hello, repo: '/synthetic/repo' },
      received: PROTOCOL_VERSION,
    },
    {
      name: 'a frame that is not a hello',
      frame: sessionContractFixtures.change,
      received: null,
    },
    { name: 'a bare string', frame: 'session:hello', received: null },
    { name: 'null', frame: null, received: null },
    {
      name: 'an array',
      frame: [{ t: 'session:hello', protocolVersion: PROTOCOL_VERSION }],
      received: null,
    },
  ]

  for (const { name, frame, received } of refused) {
    it(`refuses ${name} with a mismatch reporting both versions`, () => {
      const decision = decide(frame)

      expect(decision.outcome).toBe('mismatch')
      expect(decision.frame).toEqual({
        t: 'session:mismatch',
        code: 'protocol.update-required',
        expected: PROTOCOL_VERSION,
        received,
      })
      expect(sessionMismatchFrameSchema.parse(decision.frame)).toEqual(decision.frame)
    })
  }

  it('never answers a refused frame with a ready', () => {
    for (const { frame } of refused) {
      expect(decide(frame).frame.t).toBe('session:mismatch')
    }
  })
})
