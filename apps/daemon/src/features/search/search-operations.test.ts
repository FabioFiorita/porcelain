import type { SearchCodeOutput, SearchTextOutput } from '@porcelain/contracts/search'
import { describe, expect, it, vi } from 'vitest'
import { createSearchOperations } from './search-operations'
import type { SearchGit, SearchScope } from './search-ports'

const textOutput: SearchTextOutput = [{ path: 'src/alpha.ts', line: 3, text: 'needle' }]
const codeOutput: SearchCodeOutput = {
  files: [
    {
      path: 'src/alpha.ts',
      hunks: [{ lines: [{ line: 3, text: 'needle', match: true }] }],
      matchCount: 1,
    },
  ],
  truncated: false,
}

function fakeGit(overrides: Partial<SearchGit> = {}): SearchGit {
  return {
    listFiles: vi.fn(async () => ['src/alpha.ts', 'src/private/secret.ts']),
    searchText: vi.fn(async () => textOutput),
    searchCode: vi.fn(async () => codeOutput),
    ...overrides,
  }
}

function fakeScope(overrides: Partial<SearchScope> = {}): SearchScope {
  return {
    hiddenPaths: vi.fn(async () => new Set<string>()),
    ...overrides,
  }
}

describe('Search operations', () => {
  it('short-circuits a trimmed-empty file query before either capability', async () => {
    const git = fakeGit()
    const scope = fakeScope()
    const operations = createSearchOperations({ git, scope })

    await expect(operations.searchFiles({ repoPath: '/repo', query: '   ' })).resolves.toEqual([])
    expect(git.listFiles).not.toHaveBeenCalled()
    expect(scope.hiddenPaths).not.toHaveBeenCalled()
  })

  it('filters hidden candidates, derives directories, and caps file results at fifty', async () => {
    const git = fakeGit({
      listFiles: vi.fn(async () => [
        'src/visible.ts',
        'src/private/secret.ts',
        ...Array.from({ length: 60 }, (_, index) => `src/visible-${index}.ts`),
      ]),
    })
    const scope = fakeScope({
      hiddenPaths: vi.fn(async () => new Set(['/repo/src/private'])),
    })
    const operations = createSearchOperations({ git, scope })

    const results = await operations.searchFiles({ repoPath: '/repo', query: 'src' })

    expect(results).toHaveLength(50)
    expect(results).not.toContainEqual({ path: 'src/private/secret.ts', kind: 'file' })
    expect(results).toContainEqual({ path: 'src', kind: 'dir' })
    expect(git.listFiles).toHaveBeenCalledWith('/repo')
    expect(scope.hiddenPaths).toHaveBeenCalledWith('/repo')
  })

  it('forwards text queries unchanged', async () => {
    const searchText = vi.fn(async () => textOutput)
    const git = fakeGit({ searchText })
    const operations = createSearchOperations({ git, scope: fakeScope() })

    await expect(operations.searchText({ repoPath: '/repo', query: ' needle ' })).resolves.toEqual(
      textOutput,
    )
    expect(searchText).toHaveBeenCalledWith('/repo', ' needle ')
  })

  it('forwards every code-search flag without the wire repository field', async () => {
    const searchCode = vi.fn(async () => codeOutput)
    const git = fakeGit({ searchCode })
    const operations = createSearchOperations({ git, scope: fakeScope() })
    const input = {
      repoPath: '/repo',
      query: 'needle',
      regex: true,
      caseSensitive: false,
      include: 'src/**/*.ts',
      exclude: 'src/generated/**',
    }

    await expect(operations.searchCode(input)).resolves.toEqual(codeOutput)
    expect(searchCode).toHaveBeenCalledWith('/repo', {
      query: 'needle',
      regex: true,
      caseSensitive: false,
      include: 'src/**/*.ts',
      exclude: 'src/generated/**',
    })
  })

  it('leaves rejected capability outcomes as unexpected errors', async () => {
    const failure = new Error('git unavailable')
    const git = fakeGit({
      searchText: vi.fn(async () => {
        throw failure
      }),
    })
    const operations = createSearchOperations({ git, scope: fakeScope() })

    await expect(operations.searchText({ repoPath: '/repo', query: 'needle' })).rejects.toBe(
      failure,
    )
  })
})
