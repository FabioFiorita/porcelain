import type { GrepMatch } from '@main/diff'
import type { SearchResult } from '@main/fuzzy'
import type { CodeSearchOptions, CodeSearchResult } from '@main/git'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { keepPreviousData } from '@tanstack/react-query'

export function useFileSearch(
  query: string,
  enabled: boolean,
): { results: SearchResult[]; isFetching: boolean } {
  const repo = useRepoStore((s) => s.repo)
  const { data: results = [], isFetching } = trpc.searchFiles.useQuery(
    { repoPath: repo?.path ?? '', query },
    { enabled: enabled && repo !== null && query.trim() !== '', placeholderData: keepPreviousData },
  )
  return { results, isFetching }
}

export function useTextSearch(
  query: string,
  enabled = true,
): {
  matches: GrepMatch[] | undefined
  error: { message: string } | null
  isFetching: boolean
} {
  const repo = useRepoStore((s) => s.repo)
  const {
    data: matches,
    error,
    isFetching,
  } = trpc.searchText.useQuery(
    { repoPath: repo?.path ?? '', query },
    {
      enabled: enabled && repo !== null && query.trim() !== '',
      placeholderData: keepPreviousData,
    },
  )
  return { matches, error, isFetching }
}

/** Rich repo-wide search (regex/case/globs, context hunks) for the Search tab. */
export function useCodeSearch(
  options: CodeSearchOptions,
  enabled = true,
): {
  result: CodeSearchResult | undefined
  error: { message: string } | null
  isFetching: boolean
} {
  const repo = useRepoStore((s) => s.repo)
  const {
    data: result,
    error,
    isFetching,
  } = trpc.searchCode.useQuery(
    { repoPath: repo?.path ?? '', ...options },
    {
      enabled: enabled && repo !== null && options.query.trim() !== '',
      placeholderData: keepPreviousData,
    },
  )
  return { result, error, isFetching }
}
