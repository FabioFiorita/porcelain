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
import { daemonScopeForEnvironment, environmentClientFor } from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath, useHubRepoTarget } from '@renderer/stores/hub-repo'
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

function daemonScopeFromIdentity(
  daemon: { host: string | null; version: string | null },
  environmentId?: string | null,
): DaemonScope {
  return daemonScopeForEnvironment(environmentId, daemon)
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
  const checkout = useHubRepoPath()
  const target = useHubRepoTarget()
  const daemon = daemonScopeFromIdentity(useDaemonIdentity(), target?.environmentId)
  const utils = trpc.useUtils()
  const owner =
    target === null
      ? { client: utils.client }
      : environmentClientFor(target.environmentId, utils.client)
  const projectPath = checkout === null ? null : searchProjectKey(checkout)
  const normalizedQuery = query.trim()
  const canRun = enabled && owner !== null && projectPath !== null && normalizedQuery !== ''
  const identity =
    canRun && projectPath !== null ? fileSearchQuery(projectPath, normalizedQuery) : DISABLED_FILES
  const result = useQuery({
    enabled: canRun,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SearchResult[]> => {
      if (!canRun || projectPath === null) throw new Error('Search file query is disabled')
      if (owner === null) throw new Error('The target Environment is offline.')
      return owner.client.searchFiles.query({ query: identity.query, repoPath: projectPath })
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
  const checkout = useHubRepoPath()
  const target = useHubRepoTarget()
  const daemon = daemonScopeFromIdentity(useDaemonIdentity(), target?.environmentId)
  const utils = trpc.useUtils()
  const owner =
    target === null
      ? { client: utils.client }
      : environmentClientFor(target.environmentId, utils.client)
  const projectPath = checkout === null ? null : searchProjectKey(checkout)
  const normalizedQuery = query.trim()
  const canRun = enabled && owner !== null && projectPath !== null && normalizedQuery !== ''
  const identity =
    canRun && projectPath !== null ? textSearchQuery(projectPath, normalizedQuery) : DISABLED_TEXT
  const result = useQuery({
    enabled: canRun,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GrepMatch[]> => {
      if (!canRun || projectPath === null) throw new Error('Search text query is disabled')
      if (owner === null) throw new Error('The target Environment is offline.')
      return owner.client.searchText.query({ query: identity.query, repoPath: projectPath })
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
  const checkout = useHubRepoPath()
  const target = useHubRepoTarget()
  const daemon = daemonScopeFromIdentity(useDaemonIdentity(), target?.environmentId)
  const utils = trpc.useUtils()
  const owner =
    target === null
      ? { client: utils.client }
      : environmentClientFor(target.environmentId, utils.client)
  const projectPath = checkout === null ? null : searchProjectKey(checkout)
  const normalizedOptions: SearchCodeOptions = { ...options, query: options.query.trim() }
  const canRun = enabled && owner !== null && projectPath !== null && normalizedOptions.query !== ''
  const identity =
    canRun && projectPath !== null ? codeSearchQuery(projectPath, normalizedOptions) : DISABLED_CODE
  const result = useQuery({
    enabled: canRun,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CodeSearchResult> => {
      if (!canRun || projectPath === null) throw new Error('Search code query is disabled')
      if (owner === null) throw new Error('The target Environment is offline.')
      return owner.client.searchCode.query({
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
