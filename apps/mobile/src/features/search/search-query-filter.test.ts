import { fileSearchQuery, textSearchQuery } from '@porcelain/client-runtime/search'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { invalidateSearchEffects, searchQueryMatchesEffect } from './search-query-filter'
import { searchQueryKey } from './search-query-key'

const ENVIRONMENT = 'env-search-filter'
const OTHER_ENVIRONMENT = 'env-other'
const PROJECT = '/synthetic/repo'

describe('mobile Search query filter', () => {
  it('matches the Search family, project, and environment', () => {
    const files = searchQueryKey(ENVIRONMENT, fileSearchQuery(PROJECT, 'needle'))
    const text = searchQueryKey(ENVIRONMENT, textSearchQuery(PROJECT, 'needle'))
    expect(
      searchQueryMatchesEffect(files, { type: 'files', projectPath: PROJECT }, ENVIRONMENT),
    ).toBe(true)
    expect(
      searchQueryMatchesEffect(text, { type: 'files', projectPath: PROJECT }, ENVIRONMENT),
    ).toBe(false)
    expect(
      searchQueryMatchesEffect(files, { type: 'files', projectPath: PROJECT }, OTHER_ENVIRONMENT),
    ).toBe(false)
  })

  it('invalidates only the matching project identity', async () => {
    const queryClient = new QueryClient()
    const key = searchQueryKey(ENVIRONMENT, fileSearchQuery(PROJECT, 'needle'))
    const other = searchQueryKey(ENVIRONMENT, fileSearchQuery('/other/repo', 'needle'))
    queryClient.setQueryData(key, [])
    queryClient.setQueryData(other, [])

    await invalidateSearchEffects(queryClient, ENVIRONMENT, [
      { type: 'files', projectPath: PROJECT },
    ])

    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(false)
  })
})
