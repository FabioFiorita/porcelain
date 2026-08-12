import {
  codeSearchQuery,
  fileSearchQuery,
  type SearchCodeOptions,
  searchProjectKey,
  textSearchQuery,
} from '@porcelain/client-runtime/search'
import type { CodeSearchResult, GrepMatch, SearchResult } from '@porcelain/contracts/search'
import { searchProcedures } from '@porcelain/contracts/search'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useActiveProject } from '@/features/projects'
import { type Environment, isPaired, useActiveEnvironment } from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { callDaemon, namedContractProcedure } from '@/lib/daemon/procedure'
import { searchQueryKey } from './search-query-key'

const DISABLED_PROJECT = '/__porcelain-disabled-search__'
const DISABLED_FILES = fileSearchQuery(DISABLED_PROJECT, '')
const DISABLED_TEXT = textSearchQuery(DISABLED_PROJECT, '')
const DISABLED_CODE = codeSearchQuery(DISABLED_PROJECT, {
  caseSensitive: false,
  exclude: '',
  include: '',
  query: '',
  regex: false,
})

const searchFilesProcedure = namedContractProcedure('searchFiles', searchProcedures.searchFiles)
const searchTextProcedure = namedContractProcedure('searchText', searchProcedures.searchText)
const searchCodeProcedure = namedContractProcedure('searchCode', searchProcedures.searchCode)

function liveProjectPath(
  environment: Environment | null,
  project: ReturnType<typeof useActiveProject>,
): string | null {
  if (!isPaired(environment) || project === null) return null
  return searchProjectKey(project.path)
}

function queryError(error: unknown): Error | null {
  if (!error) return null
  return error instanceof Error ? error : new Error(String(error))
}

function disabledQuery(label: string): never {
  throw new Error(`search: disabled ${label} queryFn must not run`)
}

export function useFileSearch(
  query: string,
  active: boolean,
): { results: SearchResult[]; isLoading: boolean; error: Error | null } {
  const environment = useActiveEnvironment()
  const project = useActiveProject()
  const projectPath = liveProjectPath(environment, project)
  const trimmed = query.trim()
  const enabled = active && projectPath !== null && trimmed !== ''
  const identity =
    enabled && projectPath !== null ? fileSearchQuery(projectPath, trimmed) : DISABLED_FILES
  const result = useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SearchResult[]> => {
      if (!enabled || projectPath === null || !isPaired(environment)) return disabledQuery('files')
      return callDaemon(getDaemonClient(environment), searchFilesProcedure, {
        query: identity.query,
        repoPath: projectPath,
      })
    },
    queryKey: searchQueryKey(environment?.id ?? 'none', identity),
    staleTime: 10_000,
  })
  return {
    error: queryError(result.error),
    isLoading: result.isLoading && trimmed !== '',
    results: result.data ?? [],
  }
}

export function useTextSearch(
  query: string,
  active: boolean,
): { matches: GrepMatch[] | undefined; isLoading: boolean; error: Error | null } {
  const environment = useActiveEnvironment()
  const project = useActiveProject()
  const projectPath = liveProjectPath(environment, project)
  const trimmed = query.trim()
  const enabled = active && projectPath !== null && trimmed !== ''
  const identity =
    enabled && projectPath !== null ? textSearchQuery(projectPath, trimmed) : DISABLED_TEXT
  const result = useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GrepMatch[]> => {
      if (!enabled || projectPath === null || !isPaired(environment)) return disabledQuery('text')
      return callDaemon(getDaemonClient(environment), searchTextProcedure, {
        query: identity.query,
        repoPath: projectPath,
      })
    },
    queryKey: searchQueryKey(environment?.id ?? 'none', identity),
    staleTime: 10_000,
  })
  return {
    error: queryError(result.error),
    isLoading: result.isLoading && trimmed !== '',
    matches: result.data,
  }
}

export function useCodeSearch(
  options: SearchCodeOptions,
  active: boolean,
): { result: CodeSearchResult | undefined; isLoading: boolean; error: Error | null } {
  const environment = useActiveEnvironment()
  const project = useActiveProject()
  const projectPath = liveProjectPath(environment, project)
  const normalizedOptions: SearchCodeOptions = { ...options, query: options.query.trim() }
  const enabled = active && projectPath !== null && normalizedOptions.query !== ''
  const identity =
    enabled && projectPath !== null
      ? codeSearchQuery(projectPath, normalizedOptions)
      : DISABLED_CODE
  const result = useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CodeSearchResult> => {
      if (!enabled || projectPath === null || !isPaired(environment)) return disabledQuery('code')
      return callDaemon(getDaemonClient(environment), searchCodeProcedure, {
        caseSensitive: identity.caseSensitive,
        exclude: identity.exclude,
        include: identity.include,
        query: identity.query,
        regex: identity.regex,
        repoPath: projectPath,
      })
    },
    queryKey: searchQueryKey(environment?.id ?? 'none', identity),
    staleTime: 10_000,
  })
  return {
    error: queryError(result.error),
    isLoading: result.isLoading && normalizedOptions.query !== '',
    result: result.data,
  }
}
