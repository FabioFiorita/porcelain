import { describe, expect, it } from 'vitest'

import {
  codeSearchQuery,
  fileSearchQuery,
  SearchIdentityError,
  searchQuerySchema,
  textSearchQuery,
} from './search-queries'

describe('Search query identities', () => {
  it('normalizes project and query dimensions while preserving code options', () => {
    expect(fileSearchQuery('/repo', '  src  ')).toEqual({
      domain: 'search',
      name: 'files',
      projectPath: '/repo',
      query: 'src',
    })
    expect(
      codeSearchQuery('/repo', {
        caseSensitive: true,
        exclude: 'generated/**',
        include: 'src/**',
        query: '  needle  ',
        regex: true,
      }),
    ).toEqual({
      caseSensitive: true,
      domain: 'search',
      exclude: 'generated/**',
      include: 'src/**',
      name: 'code',
      projectPath: '/repo',
      query: 'needle',
      regex: true,
    })
  })

  it('keeps empty input typed for disabled adapters', () => {
    expect(textSearchQuery('/repo', '   ').query).toBe('')
    expect(searchQuerySchema.safeParse(textSearchQuery('/repo', '')).success).toBe(true)
  })

  it('keeps code flags and globs identity-distinct', () => {
    const base = { caseSensitive: false, exclude: '', include: '', query: 'needle', regex: false }
    expect(codeSearchQuery('/repo', base)).not.toEqual(
      codeSearchQuery('/repo', { ...base, regex: true }),
    )
    expect(codeSearchQuery('/repo', base)).not.toEqual(
      codeSearchQuery('/repo', { ...base, include: 'src/**' }),
    )
  })

  it('rejects an empty project identity', () => {
    expect(() => fileSearchQuery('', 'needle')).toThrow(SearchIdentityError)
    expect(
      searchQuerySchema.safeParse({ domain: 'search', name: 'files', projectPath: '', query: '' })
        .success,
    ).toBe(false)
  })
})
