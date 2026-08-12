import type { GrepMatch } from '@backend/git/diff'
import type { CodeSearchOptions, CodeSearchResult } from '@backend/git/git'
import type { SearchResult } from '@backend/search/fuzzy'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { keepPreviousData } from '@tanstack/react-query'

export function useFileSearch(
  query: string,
  enabled: boolean,
): { results: SearchResult[]; isFetching: boolean } {
  const project = useProjectSelectionStore((s) => s.project)
  const { data: results = [], isFetching } = trpc.searchFiles.useQuery(
    { repoPath: project?.path ?? '', query },
    {
      enabled: enabled && project !== null && query.trim() !== '',
      placeholderData: keepPreviousData,
    },
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
  const project = useProjectSelectionStore((s) => s.project)
  const {
    data: matches,
    error,
    isFetching,
  } = trpc.searchText.useQuery(
    { repoPath: project?.path ?? '', query },
    {
      enabled: enabled && project !== null && query.trim() !== '',
      placeholderData: keepPreviousData,
    },
  )
  return { matches, error, isFetching }
}

/** Rich project-wide search (regex/case/globs, context hunks) for the Search tab. */
export function useCodeSearch(
  options: CodeSearchOptions,
  enabled = true,
): {
  result: CodeSearchResult | undefined
  error: { message: string } | null
  isFetching: boolean
} {
  const project = useProjectSelectionStore((s) => s.project)
  const {
    data: result,
    error,
    isFetching,
  } = trpc.searchCode.useQuery(
    { repoPath: project?.path ?? '', ...options },
    {
      enabled: enabled && project !== null && options.query.trim() !== '',
      placeholderData: keepPreviousData,
    },
  )
  return { result, error, isFetching }
}
