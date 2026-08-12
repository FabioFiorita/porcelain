import type { Commit } from '@backend/git/diff'
import type { FlowGroup } from '@backend/review/flow'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'

export function useGitLog(limit = 200, enabled = true): Commit[] | undefined {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.gitLog.useQuery(
    { repoPath: project?.path ?? '', limit },
    { enabled: enabled && project !== null, staleTime: 0 },
  )
  return data
}

/** Commit history for a single file — the History tab's file timeline.
 *  `filePath` is null when no file is open in the viewer, which disables the
 *  query (no point asking git for an empty path). staleTime 0: the timeline
 *  should reflect new commits as they land. */
export function useFileLog(filePath: string | null, limit = 50): Commit[] | undefined {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.gitFileLog.useQuery(
    { repoPath: project?.path ?? '', filePath: filePath ?? '', limit },
    { enabled: project !== null && filePath !== null, staleTime: 0 },
  )
  return data
}

export function useCommitMessage(hash: string): string | undefined {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.gitCommitMessage.useQuery(
    { repoPath: project?.path ?? '', hash },
    { enabled: project !== null },
  )
  return data
}

/** Imperatively fetch a commit's full message (subject + body) — for copy actions. */
export function useFetchCommitMessage(): (hash: string) => Promise<string> {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  return (hash: string) =>
    project ? utils.gitCommitMessage.fetch({ repoPath: project.path, hash }) : Promise.resolve('')
}

/** Flow-grouped file list for a single historical commit.
 *  staleTime: Infinity — a commit hash is immutable, so the result never changes.
 *  No refetchInterval — unlike the live gitFlow, there's nothing to poll.
 */
export function useCommitFlow(hash: string): { groups: FlowGroup[] | undefined } {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.gitCommitFlow.useQuery(
    { repoPath: project?.path ?? '', hash },
    { enabled: project !== null, staleTime: Number.POSITIVE_INFINITY },
  )
  return { groups: data }
}
