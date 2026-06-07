import type { ChangedFile, Commit } from '@main/diff'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

export function useGitLog(limit = 200): Commit[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitLog.useQuery(
    { repoPath: repo?.path ?? '', limit },
    { enabled: repo !== null, staleTime: 0 },
  )
  return data
}

export function useCommitFiles(hash: string): ChangedFile[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitCommitFiles.useQuery(
    { repoPath: repo?.path ?? '', hash },
    { enabled: repo !== null },
  )
  return data
}
