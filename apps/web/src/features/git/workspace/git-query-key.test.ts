import { gitHeadQuery, gitStatusQuery } from '@porcelain/client-runtime/git'
import { describe, expect, it } from 'vitest'
import { gitWorkspaceQueryMatchesEffect } from './git-query-filter'
import {
  gitWorkspaceQueryKey,
  isGitWorkspaceQueryKey,
  parseGitWorkspaceQueryKey,
} from './git-query-key'

const DAEMON = { host: 'beelink', version: '0.52.1' }
const OTHER_DAEMON = { host: 'other', version: '0.52.1' }
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other'

describe('Web Git workspace keys', () => {
  it('round-trips the exact semantic query and daemon scope', () => {
    const query = gitHeadQuery(PROJECT)
    const key = gitWorkspaceQueryKey(DAEMON, query)

    expect(key).toEqual([query, DAEMON])
    expect(parseGitWorkspaceQueryKey(key)).toEqual({ daemon: DAEMON, query })
    expect(isGitWorkspaceQueryKey(key)).toBe(true)
  })

  it('matches only the same effect, project, and daemon', () => {
    const query = gitStatusQuery(PROJECT)
    const key = gitWorkspaceQueryKey(DAEMON, query)

    expect(gitWorkspaceQueryMatchesEffect(key, query, DAEMON)).toBe(true)
    expect(gitWorkspaceQueryMatchesEffect(key, gitStatusQuery(OTHER_PROJECT), DAEMON)).toBe(false)
    expect(gitWorkspaceQueryMatchesEffect(key, query, OTHER_DAEMON)).toBe(false)
    expect(gitWorkspaceQueryMatchesEffect([query, DAEMON, 'extra'], query, DAEMON)).toBe(false)
  })
})
