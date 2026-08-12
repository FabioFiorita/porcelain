import { useActiveProject } from '@/features/projects'
import { useDaemonQuery } from '@/lib/daemon/queries'

import {
  type CodeSearchOptions,
  type CodeSearchResult,
  type FileSearchResult,
  searchCodeQuery,
  searchFilesQuery,
} from './search-data'

/** Search remains on its local descriptors until the later Search client-runtime unit. */
export function useFileSearch(
  query: string,
  active: boolean,
): { results: FileSearchResult[]; isLoading: boolean; error: Error | null } {
  const project = useActiveProject()
  const trimmed = query.trim()
  const result = useDaemonQuery(
    searchFilesQuery,
    { query: trimmed, repoPath: project?.path ?? '' },
    {
      enabled: active && project !== null && trimmed !== '',
      placeholderData: 'keepPreviousData',
      staleTime: 10_000,
    },
  )
  return {
    error: result.error,
    isLoading: result.isLoading && trimmed !== '',
    results: result.data ?? [],
  }
}

export function useCodeSearch(
  options: CodeSearchOptions,
  active: boolean,
): { result: CodeSearchResult | undefined; isLoading: boolean; error: Error | null } {
  const project = useActiveProject()
  const trimmed = options.query.trim()
  const result = useDaemonQuery(
    searchCodeQuery,
    { ...options, query: trimmed, repoPath: project?.path ?? '' },
    {
      enabled: active && project !== null && trimmed !== '',
      placeholderData: 'keepPreviousData',
      staleTime: 10_000,
    },
  )
  return { error: result.error, isLoading: result.isLoading && trimmed !== '', result: result.data }
}
