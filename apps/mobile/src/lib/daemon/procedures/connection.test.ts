import { describe, expect, it } from 'vitest'

import { daemonInfoQuery, revokeCurrentClientMutation } from './connection'

/**
 * Connection owns only the Remote daemon-info and revoke bindings. Project procedure assertions
 * live under the Projects feature boundary.
 */
describe('connection procedures parse Remote contracts', () => {
  it('accepts a representative daemon-info result and rejects an incomplete one', () => {
    expect(
      daemonInfoQuery.output.parse({
        version: '0.52.1',
        protocolVersion: 1,
        host: 'daemon-host',
        platform: 'linux',
        arch: 'x64',
      }),
    ).toEqual({
      version: '0.52.1',
      protocolVersion: 1,
      host: 'daemon-host',
      platform: 'linux',
      arch: 'x64',
    })

    expect(daemonInfoQuery.output.safeParse({ version: '0.52.1' }).success).toBe(false)
  })

  it('keeps the local revoke descriptor parsing undefined', () => {
    expect(revokeCurrentClientMutation.output.parse(undefined)).toBeUndefined()
  })
})
