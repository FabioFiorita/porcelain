import type { Worktree } from '@main/diff'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

export function useBranch(): string | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitBranch.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    staleTime: 0,
    refetchInterval: 5000,
  })
  return data
}

export function useWorktrees(): Worktree[] {
  const repo = useRepoStore((s) => s.repo)
  const { data = [] } = trpc.gitWorktrees.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data
}
