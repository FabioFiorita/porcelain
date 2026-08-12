import {
  codeSearchQuery,
  fileSearchQuery,
  type SearchCodeOptions,
  searchProjectKey,
  textSearchQuery,
} from '@porcelain/client-runtime/search'
import type { CodeSearchResult, GrepMatch, SearchResult } from '@porcelain/contracts/search'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

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

function daemonScopeFromIdentity(daemon: {
  host: string | null
  version: string | null
}): DaemonScope {
  return { host: daemon.host, version: daemon.version }
}

function errorValue(error: unknown): { message: string } | null {
  return error instanceof Error
    ? error
    : error === null || error === undefined
      ? null
      : { message: String(error) }
}

export function useFileSearch(
  query: string,
  enabled: boolean,
): { results: SearchResult[]; isFetching: boolean } {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = daemonScopeFromIdentity(useDaemonIdentity())
  const utils = trpc.useUtils()
  const projectPath = project === null ? null : searchProjectKey(project.path)
  const normalizedQuery = query.trim()
  const canRun = enabled && projectPath !== null && normalizedQuery !== ''
  const identity =
    canRun && projectPath !== null ? fileSearchQuery(projectPath, normalizedQuery) : DISABLED_FILES
  const result = useQuery({
    enabled: canRun,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SearchResult[]> => {
      if (!canRun || projectPath === null) throw new Error('Search file query is disabled')
      return utils.client.searchFiles.query({ query: identity.query, repoPath: projectPath })
    },
    queryKey: searchQueryKey(daemon, identity),
  })
  return { isFetching: result.isFetching, results: result.data ?? [] }
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
  const daemon = daemonScopeFromIdentity(useDaemonIdentity())
  const utils = trpc.useUtils()
  const projectPath = project === null ? null : searchProjectKey(project.path)
  const normalizedQuery = query.trim()
  const canRun = enabled && projectPath !== null && normalizedQuery !== ''
  const identity =
    canRun && projectPath !== null ? textSearchQuery(projectPath, normalizedQuery) : DISABLED_TEXT
  const result = useQuery({
    enabled: canRun,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GrepMatch[]> => {
      if (!canRun || projectPath === null) throw new Error('Search text query is disabled')
      return utils.client.searchText.query({ query: identity.query, repoPath: projectPath })
    },
    queryKey: searchQueryKey(daemon, identity),
  })
  return {
    error: errorValue(result.error),
    isFetching: result.isFetching,
    matches: result.data,
  }
}

/** Rich project-wide search (regex/case/globs, context hunks) for the Search tab. */
export function useCodeSearch(
  options: SearchCodeOptions,
  enabled = true,
): {
  result: CodeSearchResult | undefined
  error: { message: string } | null
  isFetching: boolean
} {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = daemonScopeFromIdentity(useDaemonIdentity())
  const utils = trpc.useUtils()
  const projectPath = project === null ? null : searchProjectKey(project.path)
  const normalizedOptions: SearchCodeOptions = { ...options, query: options.query.trim() }
  const canRun = enabled && projectPath !== null && normalizedOptions.query !== ''
  const identity =
    canRun && projectPath !== null ? codeSearchQuery(projectPath, normalizedOptions) : DISABLED_CODE
  const result = useQuery({
    enabled: canRun,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CodeSearchResult> => {
      if (!canRun || projectPath === null) throw new Error('Search code query is disabled')
      return utils.client.searchCode.query({
        caseSensitive: identity.caseSensitive,
        exclude: identity.exclude,
        include: identity.include,
        query: identity.query,
        regex: identity.regex,
        repoPath: projectPath,
      })
    },
    queryKey: searchQueryKey(daemon, identity),
  })
  return {
    error: errorValue(result.error),
    isFetching: result.isFetching,
    result: result.data,
  }
}
