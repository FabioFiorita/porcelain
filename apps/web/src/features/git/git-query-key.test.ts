import {
  gitDiffFileQuery,
  gitDiffQuery,
  gitFileLogQuery,
  gitFileLogQueryFamily,
  gitHeadQuery,
  gitLogQuery,
  gitLogQueryFamily,
  gitStatusQuery,
} from '@porcelain/client-runtime/git'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  gitQueryKey,
  gitQueryMatchesEffect,
  invalidateAllGitQueries,
  invalidateGitEffects,
  invalidateGitProject,
  invalidateGitWorkingTree,
  isGitQueryKey,
  parseGitQueryKey,
} from './git-query-filter'

const DAEMON = { host: 'beelink', version: '0.52.1' }
const OTHER_DAEMON = { host: 'other', version: '0.52.1' }
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other'

describe('Web Git semantic keys', () => {
  it('round-trips the exact semantic query and daemon scope', () => {
    const query = gitHeadQuery(PROJECT)
    const key = gitQueryKey(DAEMON, query)

    expect(key).toEqual([query, DAEMON])
    expect(parseGitQueryKey(key)).toEqual({ daemon: DAEMON, query })
    expect(isGitQueryKey(key)).toBe(true)
  })

  it('matches only the same effect, project, and daemon', () => {
    const query = gitStatusQuery(PROJECT)
    const key = gitQueryKey(DAEMON, query)

    expect(gitQueryMatchesEffect(key, query, DAEMON)).toBe(true)
    expect(gitQueryMatchesEffect(key, gitStatusQuery(OTHER_PROJECT), DAEMON)).toBe(false)
    expect(gitQueryMatchesEffect(key, query, OTHER_DAEMON)).toBe(false)
    expect(gitQueryMatchesEffect([query, DAEMON, 'extra'], query, DAEMON)).toBe(false)
  })

  it('matches a family effect against every exact identity in that family only', () => {
    const diffA = gitQueryKey(DAEMON, gitDiffFileQuery(PROJECT, 'src/a.ts'))
    const diffB = gitQueryKey(DAEMON, gitDiffFileQuery(PROJECT, 'src/b.ts'))
    const log = gitQueryKey(DAEMON, gitLogQuery(PROJECT, 200))
    const fileLog = gitQueryKey(DAEMON, gitFileLogQuery(PROJECT, 'src/a.ts', 50))

    expect(gitQueryMatchesEffect(diffA, gitDiffQuery(PROJECT), DAEMON)).toBe(true)
    expect(gitQueryMatchesEffect(diffB, gitDiffQuery(PROJECT), DAEMON)).toBe(true)
    expect(gitQueryMatchesEffect(log, gitDiffQuery(PROJECT), DAEMON)).toBe(false)
    expect(gitQueryMatchesEffect(log, gitLogQueryFamily(PROJECT), DAEMON)).toBe(true)
    expect(gitQueryMatchesEffect(fileLog, gitLogQueryFamily(PROJECT), DAEMON)).toBe(false)
    expect(gitQueryMatchesEffect(fileLog, gitFileLogQueryFamily(PROJECT), DAEMON)).toBe(true)
    // A family never crosses the project dimension.
    expect(gitQueryMatchesEffect(diffA, gitDiffQuery(OTHER_PROJECT), DAEMON)).toBe(false)
  })
})

describe('Web Git effect invalidation', () => {
  it('invalidates only the named exact identities', async () => {
    const queryClient = new QueryClient()
    const head = gitQueryKey(DAEMON, gitHeadQuery(PROJECT))
    const status = gitQueryKey(DAEMON, gitStatusQuery(PROJECT))
    queryClient.setQueryData(head, {})
    queryClient.setQueryData(status, [])

    await invalidateGitEffects(queryClient, DAEMON, [gitHeadQuery(PROJECT)])

    expect(queryClient.getQueryState(head)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(status)?.isInvalidated).toBeFalsy()
  })

  it('working-tree handoff refreshes the flow and the whole working diff family', async () => {
    const queryClient = new QueryClient()
    const flowKey = gitQueryKey(DAEMON, gitHeadQuery(PROJECT))
    const diffA = gitQueryKey(DAEMON, gitDiffFileQuery(PROJECT, 'src/a.ts'))
    const diffB = gitQueryKey(DAEMON, gitDiffFileQuery(PROJECT, 'src/b.ts'))
    queryClient.setQueryData(flowKey, {})
    queryClient.setQueryData(diffA, {})
    queryClient.setQueryData(diffB, {})

    await invalidateGitWorkingTree(queryClient, DAEMON, PROJECT)

    expect(queryClient.getQueryState(diffA)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(diffB)?.isInvalidated).toBe(true)
  })

  it('project recovery selects one project; session recovery selects every Git identity', async () => {
    const queryClient = new QueryClient()
    const mine = gitQueryKey(DAEMON, gitHeadQuery(PROJECT))
    const theirs = gitQueryKey(DAEMON, gitHeadQuery(OTHER_PROJECT))
    const foreign = ['not', 'a', 'git', 'key'] as const
    queryClient.setQueryData(mine, {})
    queryClient.setQueryData(theirs, {})
    queryClient.setQueryData(foreign, {})

    await invalidateGitProject(queryClient, DAEMON, PROJECT)
    expect(queryClient.getQueryState(mine)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(theirs)?.isInvalidated).toBeFalsy()

    await invalidateAllGitQueries(queryClient)
    expect(queryClient.getQueryState(theirs)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(foreign)?.isInvalidated).toBeFalsy()
  })
})
