import { describe, expect, expectTypeOf, it } from 'vitest'

import type { DaemonQuery } from '../procedure'
import { searchCodeQuery, searchFilesQuery, searchTextQuery } from './files'

describe('mobile search procedure descriptors', () => {
  it('retains only the Search descriptors after Files cutover', () => {
    expect(searchFilesQuery.name).toBe('searchFiles')
    expect(searchTextQuery.name).toBe('searchText')
    expect(searchCodeQuery.name).toBe('searchCode')

    type SearchInput = typeof searchCodeQuery extends DaemonQuery<infer I, unknown> ? I : never
    expectTypeOf<SearchInput>().toEqualTypeOf<{
      repoPath: string
      query: string
      regex: boolean
      caseSensitive: boolean
      include: string
      exclude: string
    }>()
  })
})
