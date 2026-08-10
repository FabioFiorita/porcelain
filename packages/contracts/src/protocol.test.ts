import { describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER, protocolVersionSchema } from './protocol'

/**
 * The protocol version is a shared literal, not a derived or configurable value: a client
 * that could negotiate it would have nothing to compare against. These cases pin the exact
 * value and prove the schema accepts nothing else.
 */
describe('protocol version', () => {
  it('is the literal version 1', () => {
    expect(PROTOCOL_VERSION).toBe(1)
  })

  it('accepts only that literal', () => {
    expect(protocolVersionSchema.parse(PROTOCOL_VERSION)).toBe(1)
    for (const malformed of [0, 2, 1.5, '1', true, null, undefined, {}]) {
      expect(protocolVersionSchema.safeParse(malformed).success, `${String(malformed)}`).toBe(false)
    }
  })

  // Every client spells the header from this constant; the daemon boundary reads the same
  // one. A drifted literal in one adapter would look like a versionless client.
  it('names one lowercase header for the version', () => {
    expect(PROTOCOL_VERSION_HEADER).toBe('x-porcelain-protocol-version')
    expect(PROTOCOL_VERSION_HEADER).toBe(PROTOCOL_VERSION_HEADER.toLowerCase())
  })
})
