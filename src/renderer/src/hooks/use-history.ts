import type { Commit } from '@main/diff'
import type { FlowGroup } from '@main/flow'
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

/** Commit history for a single file — the History tab's file timeline.
 *  `filePath` is null when no file is open in the viewer, which disables the
 *  query (no point asking git for an empty path). staleTime 0: the timeline
 *  should reflect new commits as they land. */
export function useFileLog(filePath: string | null, limit = 50): Commit[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitFileLog.useQuery(
    { repoPath: repo?.path ?? '', filePath: filePath ?? '', limit },
    { enabled: repo !== null && filePath !== null, staleTime: 0 },
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

/** Flow-grouped file list for a single historical commit.
 *  staleTime: Infinity — a commit hash is immutable, so the result never changes.
 *  No refetchInterval — unlike the live gitFlow, there's nothing to poll.
 */
export function useCommitFlow(hash: string): { groups: FlowGroup[] | undefined } {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitCommitFlow.useQuery(
    { repoPath: repo?.path ?? '', hash },
    { enabled: repo !== null, staleTime: Number.POSITIVE_INFINITY },
  )
  return { groups: data }
}
