import { fileSearchQuery, textSearchQuery } from '@porcelain/client-runtime/search'
import { filesNotificationFixtures } from '@porcelain/contracts/files'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { applySearchForeignDependencies, applySearchNotification } from './search-notifications'
import { searchQueryKey } from './search-query-key'

const DAEMON = { host: 'beelink', version: '0.52.1' }
const PROJECT = '/synthetic/repo'

describe('Web Search notifications', () => {
  it('owns Files fact invalidation and leaves another project fresh', async () => {
    const queryClient = new QueryClient()
    const fileKey = searchQueryKey(DAEMON, fileSearchQuery(PROJECT, 'needle'))
    const otherKey = searchQueryKey(DAEMON, fileSearchQuery('/other/repo', 'needle'))
    queryClient.setQueryData(fileKey, [])
    queryClient.setQueryData(otherKey, [])

    applySearchNotification(filesNotificationFixtures['files.tree-changed'], {
      activeProjectPath: PROJECT,
      daemon: DAEMON,
      queryClient,
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(queryClient.getQueryState(fileKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false)
  })

  it('maps a content fact to text Search and ignores an inactive project', async () => {
    const queryClient = new QueryClient()
    const textKey = searchQueryKey(DAEMON, textSearchQuery(PROJECT, 'needle'))
    queryClient.setQueryData(textKey, [])

    applySearchNotification(filesNotificationFixtures['files.content-changed'], {
      activeProjectPath: '/other/repo',
      daemon: DAEMON,
      queryClient,
    })
    await Promise.resolve()
    expect(queryClient.getQueryState(textKey)?.isInvalidated).toBe(false)
  })

  it('rebinds Files mutation tokens through typed Search invalidation', async () => {
    const queryClient = new QueryClient()
    const key = searchQueryKey(DAEMON, textSearchQuery(PROJECT, 'needle'))
    queryClient.setQueryData(key, [])

    await applySearchForeignDependencies(queryClient, DAEMON, PROJECT, [
      { domain: 'search', name: 'content-index' },
    ])

    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
  })
})
