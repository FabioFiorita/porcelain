import { describe, expect, it } from 'vitest'

import {
  browseDirsQuery,
  daemonInfoQuery,
  openRepoPathMutation,
  recentReposQuery,
  removeRecentRepoMutation,
  revokeCurrentClientMutation,
} from './connection'

/**
 * Connection now parses daemon responses with the canonical Remote and Projects contracts
 * (`@porcelain/contracts/remote` and `@porcelain/contracts/projects`) instead of horizontal root
 * copies. These cases pin the wire values those subpath schemas must accept and reject.
 */
describe('connection procedures parse canonical domain contracts', () => {
  it('accepts a representative daemon-info result and rejects an incomplete one', () => {
    expect(
      daemonInfoQuery.output.parse({
        version: '0.52.1',
        host: 'daemon-host',
        platform: 'linux',
        arch: 'x64',
      }),
    ).toEqual({ version: '0.52.1', host: 'daemon-host', platform: 'linux', arch: 'x64' })

    expect(daemonInfoQuery.output.safeParse({ version: '0.52.1' }).success).toBe(false)
  })

  it('accepts representative recent and opened project results', () => {
    const repos = [
      { path: '/projects/alpha', name: 'alpha' },
      { path: '/projects/beta', name: 'beta' },
    ]
    expect(recentReposQuery.output.parse(repos)).toEqual(repos)
    expect(openRepoPathMutation.output.parse(repos[0])).toEqual(repos[0])
    expect(recentReposQuery.output.safeParse([{ path: '/projects/alpha' }]).success).toBe(false)
  })

  it('accepts a representative browse result including a null parent', () => {
    const browse = {
      path: '/projects',
      parent: null,
      entries: [{ name: 'alpha', path: '/projects/alpha', isRepo: true }],
    }
    expect(browseDirsQuery.output.parse(browse)).toEqual(browse)
    expect(
      browseDirsQuery.output.safeParse({ path: '/projects', parent: null, entries: [{}] }).success,
    ).toBe(false)
  })

  it('keeps the local void descriptors parsing undefined', () => {
    expect(removeRecentRepoMutation.output.parse(undefined)).toBeUndefined()
    expect(revokeCurrentClientMutation.output.parse(undefined)).toBeUndefined()
  })
})
