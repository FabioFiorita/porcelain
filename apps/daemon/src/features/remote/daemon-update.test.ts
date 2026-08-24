import { describe, expect, it, vi } from 'vitest'
import { daemonRestartable, fetchPublishedVersion } from './daemon-update'

describe('daemonRestartable', () => {
  it('is true only for a non-dev systemd invocation', () => {
    expect(daemonRestartable({ INVOCATION_ID: 'abc' })).toBe(true)
    expect(daemonRestartable({ INVOCATION_ID: 'abc', PORCELAIN_DEV: '1' })).toBe(false)
    expect(daemonRestartable({})).toBe(false)
    expect(daemonRestartable({ INVOCATION_ID: '' })).toBe(false)
  })
})

describe('fetchPublishedVersion', () => {
  it('reads version from the npm latest document', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify({ version: '0.60.0' }), { status: 200 })
    })
    await expect(fetchPublishedVersion(fetchImpl)).resolves.toBe('0.60.0')
  })

  it('returns null when the registry is unreachable or malformed', async () => {
    const failing = vi.fn<typeof fetch>(async () => {
      throw new Error('network')
    })
    await expect(fetchPublishedVersion(failing)).resolves.toBeNull()
    const bad = vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 }))
    await expect(fetchPublishedVersion(bad)).resolves.toBeNull()
  })
})
