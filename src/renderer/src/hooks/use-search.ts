import type { GrepMatch } from '@main/diff'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { keepPreviousData } from '@tanstack/react-query'

export function useFileSearch(
  query: string,
  enabled: boolean,
): { results: string[]; isFetching: boolean } {
  const repo = useRepoStore((s) => s.repo)
  const { data: results = [], isFetching } = trpc.searchFiles.useQuery(
    { repoPath: repo?.path ?? '', query },
    { enabled: enabled && repo !== null && query.trim() !== '', placeholderData: keepPreviousData },
  )
  return { results, isFetching }
}

export function useTextSearch(query: string): {
  matches: GrepMatch[] | undefined
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
  const { data: matches, error } = trpc.searchText.useQuery(
    { repoPath: repo?.path ?? '', query },
    { enabled: repo !== null },
  )
  return { matches, error }
}
