import { codeSearchQuery, fileSearchQuery, textSearchQuery } from '@porcelain/client-runtime/search'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { invalidateSearchEffects, searchQueryMatchesEffect } from './search-query-filter'
import { searchQueryKey } from './search-query-key'

const DAEMON = { host: 'beelink', version: '0.52.1' }
const OTHER_DAEMON = { host: 'other', version: '0.52.1' }
const PROJECT = '/synthetic/repo'

describe('Web Search query filter', () => {
  it('matches only the effect family, project, and daemon', () => {
    const fileKey = searchQueryKey(DAEMON, fileSearchQuery(PROJECT, 'needle'))
    const textKey = searchQueryKey(DAEMON, textSearchQuery(PROJECT, 'needle'))
    const codeKey = searchQueryKey(
      DAEMON,
      codeSearchQuery(PROJECT, {
        caseSensitive: false,
        exclude: '',
        include: '',
        query: 'needle',
        regex: false,
      }),
    )

    expect(searchQueryMatchesEffect(fileKey, { type: 'files', projectPath: PROJECT }, DAEMON)).toBe(
      true,
    )
    expect(searchQueryMatchesEffect(textKey, { type: 'files', projectPath: PROJECT }, DAEMON)).toBe(
      false,
    )
    expect(
      searchQueryMatchesEffect(codeKey, { type: 'code', projectPath: PROJECT }, OTHER_DAEMON),
    ).toBe(false)
  })

  it('invalidates only the typed Search identities for an effect', async () => {
    const queryClient = new QueryClient()
    const fileKey = searchQueryKey(DAEMON, fileSearchQuery(PROJECT, 'needle'))
    const otherProjectKey = searchQueryKey(DAEMON, fileSearchQuery('/other/repo', 'needle'))
    queryClient.setQueryData(fileKey, [])
    queryClient.setQueryData(otherProjectKey, [])

    await invalidateSearchEffects(queryClient, DAEMON, [
      { type: 'files', projectPath: PROJECT },
      { type: 'files', projectPath: PROJECT },
    ])

    expect(queryClient.getQueryState(fileKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherProjectKey)?.isInvalidated).toBe(false)
  })
})
