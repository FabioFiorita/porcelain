import { fileSearchQuery, textSearchQuery } from '@porcelain/client-runtime/search'
import { filesNotificationFixtures } from '@porcelain/contracts/files'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/daemon/environments-store', () => ({
  useActiveEnvironment: () => ({ id: 'env-search-notifications', token: 'paired' }),
}))
vi.mock('@/features/projects', () => ({
  useActiveProject: () => ({ name: 'repo', path: '/synthetic/repo' }),
}))
vi.mock('@/lib/daemon/session', () => ({
  subscribeSessionChanges: () => () => undefined,
}))

import { applySearchForeignDependencies, applySearchNotification } from './search-notifications'
import { searchQueryKey } from './search-query-key'

const ENVIRONMENT = 'env-search-notifications'
const PROJECT = '/synthetic/repo'

describe('mobile Search notifications', () => {
  it('invalidates active-project file Search for a typed tree fact', async () => {
    const queryClient = new QueryClient()
    const key = searchQueryKey(ENVIRONMENT, fileSearchQuery(PROJECT, 'needle'))
    queryClient.setQueryData(key, [])

    applySearchNotification(filesNotificationFixtures['files.tree-changed'], {
      activeProjectPath: PROJECT,
      environmentId: ENVIRONMENT,
      queryClient,
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
  })

  it('maps content facts to text and code but ignores another active project', async () => {
    const queryClient = new QueryClient()
    const key = searchQueryKey(ENVIRONMENT, textSearchQuery(PROJECT, 'needle'))
    queryClient.setQueryData(key, [])

    applySearchNotification(filesNotificationFixtures['files.content-changed'], {
      activeProjectPath: '/other/repo',
      environmentId: ENVIRONMENT,
      queryClient,
    })
    await Promise.resolve()
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false)
  })

  it('rebinds Search mutation tokens without raw procedure keys', async () => {
    const queryClient = new QueryClient()
    const key = searchQueryKey(ENVIRONMENT, textSearchQuery(PROJECT, 'needle'))
    queryClient.setQueryData(key, [])

    await applySearchForeignDependencies(queryClient, ENVIRONMENT, PROJECT, [
      { domain: 'search', name: 'content-index' },
    ])

    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
  })
})
