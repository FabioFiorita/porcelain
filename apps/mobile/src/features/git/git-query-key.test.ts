import {
  gitCommitDiffQuery,
  gitCommitModelsQuery,
  gitDiffFileQuery,
  gitDiffQuery,
  gitDiffReadingQuery,
  gitDiffReadingQueryFamily,
  gitFlowQuery,
  gitHeadQuery,
  gitLogQuery,
  gitLogQueryFamily,
  gitStatusQuery,
} from '@porcelain/client-runtime/git'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import {
  gitQueryMatchesEffect,
  invalidateAllGitQueries,
  invalidateGitEffects,
  invalidateGitProject,
  invalidateGitWorkingTree,
} from './git-query-filter'
import { gitQueryKey, isGitQueryKey, parseGitQueryKey } from './git-query-key'

const ENVIRONMENT = 'env-git-test'
const OTHER_ENVIRONMENT = 'env-other'
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other'

describe('Mobile Git cache keys', () => {
  it('round-trips the daemon environment and the semantic query', () => {
    const query = gitHeadQuery(PROJECT)
    const key = gitQueryKey(ENVIRONMENT, query)

    expect(key).toEqual(['daemon', ENVIRONMENT, query])
    expect(parseGitQueryKey(key)).toEqual({ environmentId: ENVIRONMENT, query })
    expect(isGitQueryKey(key)).toBe(true)
    expect(isGitQueryKey(['daemon', ENVIRONMENT, query, 'extra'])).toBe(false)
  })

  it('keys the daemon-scoped commit-model read with no project dimension', () => {
    const key = gitQueryKey(ENVIRONMENT, gitCommitModelsQuery())
    expect(parseGitQueryKey(key)?.query).toEqual({ domain: 'git', name: 'commit-models' })
  })

  it('matches an exact effect only against the identical identity', () => {
    const key = gitQueryKey(ENVIRONMENT, gitDiffFileQuery(PROJECT, 'src/main.ts'))

    expect(gitQueryMatchesEffect(key, gitDiffFileQuery(PROJECT, 'src/main.ts'), ENVIRONMENT)).toBe(
      true,
    )
    expect(gitQueryMatchesEffect(key, gitDiffFileQuery(PROJECT, 'src/other.ts'), ENVIRONMENT)).toBe(
      false,
    )
    expect(
      gitQueryMatchesEffect(key, gitDiffFileQuery(OTHER_PROJECT, 'src/main.ts'), ENVIRONMENT),
    ).toBe(false)
    expect(
      gitQueryMatchesEffect(key, gitDiffFileQuery(PROJECT, 'src/main.ts'), OTHER_ENVIRONMENT),
    ).toBe(false)
  })

  it('matches a family effect against every exact identity in that family', () => {
    const first = gitQueryKey(ENVIRONMENT, gitDiffFileQuery(PROJECT, 'src/main.ts'))
    const second = gitQueryKey(ENVIRONMENT, gitDiffFileQuery(PROJECT, 'docs/readme.md'))
    const commitDiff = gitQueryKey(ENVIRONMENT, gitCommitDiffQuery(PROJECT, 'abc', 'src/main.ts'))

    expect(gitQueryMatchesEffect(first, gitDiffQuery(PROJECT), ENVIRONMENT)).toBe(true)
    expect(gitQueryMatchesEffect(second, gitDiffQuery(PROJECT), ENVIRONMENT)).toBe(true)
    // A commit's diff is immutable — the working-tree family must never reach it.
    expect(gitQueryMatchesEffect(commitDiff, gitDiffQuery(PROJECT), ENVIRONMENT)).toBe(false)
    expect(gitQueryMatchesEffect(first, gitDiffQuery(OTHER_PROJECT), ENVIRONMENT)).toBe(false)
  })
})

describe('Mobile Git effect invalidation', () => {
  it('invalidates a whole family and leaves other projects fresh', async () => {
    const queryClient = new QueryClient()
    const main = gitQueryKey(ENVIRONMENT, gitDiffFileQuery(PROJECT, 'src/main.ts'))
    const readme = gitQueryKey(ENVIRONMENT, gitDiffFileQuery(PROJECT, 'docs/readme.md'))
    const other = gitQueryKey(ENVIRONMENT, gitDiffFileQuery(OTHER_PROJECT, 'src/main.ts'))
    for (const key of [main, readme, other]) queryClient.setQueryData(key, {})

    await invalidateGitEffects(queryClient, ENVIRONMENT, [gitDiffQuery(PROJECT)])

    expect(queryClient.getQueryState(main)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(readme)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
  })

  it('invalidates only the identical identity for an exact effect', async () => {
    const queryClient = new QueryClient()
    const working = gitQueryKey(ENVIRONMENT, gitDiffReadingQuery(PROJECT, { type: 'working' }))
    const branch = gitQueryKey(ENVIRONMENT, gitDiffReadingQuery(PROJECT, { type: 'branch' }))
    for (const key of [working, branch]) queryClient.setQueryData(key, {})

    await invalidateGitEffects(queryClient, ENVIRONMENT, [
      gitDiffReadingQuery(PROJECT, { type: 'working' }),
    ])

    expect(queryClient.getQueryState(working)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(branch)?.isInvalidated).toBeFalsy()

    await invalidateGitEffects(queryClient, ENVIRONMENT, [gitDiffReadingQueryFamily(PROJECT)])
    expect(queryClient.getQueryState(branch)?.isInvalidated).toBe(true)
  })

  it('recovers a session including the daemon-scoped model list, and one project alone', async () => {
    const queryClient = new QueryClient()
    const flow = gitQueryKey(ENVIRONMENT, gitFlowQuery(PROJECT))
    const log = gitQueryKey(ENVIRONMENT, gitLogQuery(PROJECT))
    const other = gitQueryKey(ENVIRONMENT, gitFlowQuery(OTHER_PROJECT))
    const models = gitQueryKey(ENVIRONMENT, gitCommitModelsQuery())
    const foreign = gitQueryKey(OTHER_ENVIRONMENT, gitFlowQuery(PROJECT))
    for (const key of [flow, log, other, models, foreign]) queryClient.setQueryData(key, {})

    await invalidateGitProject(queryClient, ENVIRONMENT, PROJECT)
    expect(queryClient.getQueryState(flow)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(log)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
    // A project gap says nothing about a daemon-scoped read.
    expect(queryClient.getQueryState(models)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(foreign)?.isInvalidated).toBeFalsy()

    await invalidateAllGitQueries(queryClient, ENVIRONMENT)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(models)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(foreign)?.isInvalidated).toBeFalsy()
  })

  it('moves only the working tree for the Files foreign handoff', async () => {
    const queryClient = new QueryClient()
    const flow = gitQueryKey(ENVIRONMENT, gitFlowQuery(PROJECT))
    const status = gitQueryKey(ENVIRONMENT, gitStatusQuery(PROJECT))
    const diff = gitQueryKey(ENVIRONMENT, gitDiffFileQuery(PROJECT, 'src/main.ts'))
    const reading = gitQueryKey(ENVIRONMENT, gitDiffReadingQuery(PROJECT, { type: 'working' }))
    const history = gitQueryKey(ENVIRONMENT, gitLogQuery(PROJECT))
    for (const key of [flow, status, diff, reading, history]) queryClient.setQueryData(key, {})

    await invalidateGitWorkingTree(queryClient, ENVIRONMENT, PROJECT)

    for (const key of [flow, status, diff, reading]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    }
    // Writing a file does not rewrite history.
    expect(queryClient.getQueryState(history)?.isInvalidated).toBeFalsy()
    expect(gitQueryMatchesEffect(history, gitLogQueryFamily(PROJECT), ENVIRONMENT)).toBe(true)
  })
})
