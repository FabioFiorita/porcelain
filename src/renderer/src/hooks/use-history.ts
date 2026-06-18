import type { ChangedFile, Commit } from '@main/diff'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

export function useGitLog(limit = 200, enabled = true): Commit[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitLog.useQuery(
    { repoPath: repo?.path ?? '', limit },
    { enabled: enabled && repo !== null, staleTime: 0 },
  )
  return data
}

export function useCommitMessage(hash: string): string | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitCommitMessage.useQuery(
    { repoPath: repo?.path ?? '', hash },
    { enabled: repo !== null },
  )
  return data
}

/** Imperatively fetch a commit's full message (subject + body) — for copy actions. */
export function useFetchCommitMessage(): (hash: string) => Promise<string> {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  return (hash: string) =>
    repo ? utils.gitCommitMessage.fetch({ repoPath: repo.path, hash }) : Promise.resolve('')
}

export function useCommitFiles(hash: string): ChangedFile[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitCommitFiles.useQuery(
    { repoPath: repo?.path ?? '', hash },
    { enabled: repo !== null },
  )
  return data
}
