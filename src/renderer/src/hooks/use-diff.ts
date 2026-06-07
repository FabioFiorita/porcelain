import type { DiffHunk } from '@main/diff'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

export function useDiffFile(filePath: string): {
  hunks: DiffHunk[] | undefined
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
  const { data: hunks, error } = trpc.gitDiffFile.useQuery(
    { repoPath: repo?.path ?? '', filePath },
    // diffs go stale the moment the agent writes; refetch on tab focus, keep last data visible
    { enabled: repo !== null, staleTime: 0, keepPreviousData: true },
  )
  return { hunks, error }
}

/** Prefetch a file's diff (changes-list hover) so opening the diff tab feels instant. */
export function useDiffFilePrefetch(): (filePath: string) => Promise<void> {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  return async (filePath) => {
    if (!repo) return
    await utils.gitDiffFile.prefetch({ repoPath: repo.path, filePath }, { staleTime: 2000 })
  }
}

export function useCommitDiff(
  hash: string,
  filePath: string,
): { hunks: DiffHunk[] | undefined; error: { message: string } | null } {
  const repo = useRepoStore((s) => s.repo)
  const { data: hunks, error } = trpc.gitCommitDiff.useQuery(
    { repoPath: repo?.path ?? '', hash, filePath },
    { enabled: repo !== null },
  )
  return { hunks, error }
}
