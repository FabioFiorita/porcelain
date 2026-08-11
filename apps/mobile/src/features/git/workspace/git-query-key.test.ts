import { gitHeadQuery, gitStatusQuery } from '@porcelain/client-runtime/git'
import { describe, expect, it } from 'vitest'
import { gitWorkspaceQueryMatchesEffect } from './git-query-filter'
import {
  gitWorkspaceQueryKey,
  isGitWorkspaceQueryKey,
  parseGitWorkspaceQueryKey,
} from './git-query-key'

const ENVIRONMENT = 'env-git-test'
const OTHER_ENVIRONMENT = 'env-other'
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other'

describe('Mobile Git workspace keys', () => {
  it('round-trips the exact daemon environment and semantic query', () => {
    const query = gitHeadQuery(PROJECT)
    const key = gitWorkspaceQueryKey(ENVIRONMENT, query)

    expect(key).toEqual(['daemon', ENVIRONMENT, query])
    expect(parseGitWorkspaceQueryKey(key)).toEqual({ environmentId: ENVIRONMENT, query })
    expect(isGitWorkspaceQueryKey(key)).toBe(true)
  })

  it('matches only the same effect, project, and environment', () => {
    const query = gitStatusQuery(PROJECT)
    const key = gitWorkspaceQueryKey(ENVIRONMENT, query)

    expect(gitWorkspaceQueryMatchesEffect(key, query, ENVIRONMENT)).toBe(true)
    expect(gitWorkspaceQueryMatchesEffect(key, gitStatusQuery(OTHER_PROJECT), ENVIRONMENT)).toBe(
      false,
    )
    expect(gitWorkspaceQueryMatchesEffect(key, query, OTHER_ENVIRONMENT)).toBe(false)
    expect(isGitWorkspaceQueryKey(['daemon', ENVIRONMENT, query, 'extra'])).toBe(false)
  })
})
