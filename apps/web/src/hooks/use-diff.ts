import type { DiffHunk, FileStatus } from '@backend/git/diff'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { settleBackground } from '@shared/background'
import { keepPreviousData } from '@tanstack/react-query'

export function useDiffFile(
  filePath: string,
  base?: string,
): {
  hunks: DiffHunk[] | undefined
  status: FileStatus | undefined
  image: { dataUrl: string } | undefined
  binary: boolean
  error: { message: string } | null
} {
  const project = useProjectSelectionStore((s) => s.project)
  const working = trpc.gitDiffFile.useQuery(
    { repoPath: project?.path ?? '', filePath },
    // diffs go stale the moment the agent writes; refetch on tab focus, keep last data visible
    {
      enabled: project !== null && base === undefined,
      staleTime: 0,
      placeholderData: keepPreviousData,
    },
  )
  const range = trpc.gitRangeDiffFile.useQuery(
    { repoPath: project?.path ?? '', base: base ?? '', filePath },
    {
      enabled: project !== null && base !== undefined,
      staleTime: Number.POSITIVE_INFINITY,
      placeholderData: keepPreviousData,
    },
  )
  const active = base === undefined ? working : range
  return {
    hunks: active.data?.hunks,
    status: active.data?.status,
    image: active.data?.image,
    binary: active.data?.binary === true,
    error: active.error,
  }
}

/**
 * Hover prefetch as the UI actually uses it: nobody awaits a warm-up, and a failed one
 * only means the next open is slower, so the hook owns the disposition and hands the
 * event edge a plain void call.
 */
export function useDiffFileHoverPrefetch(): (filePath: string, base?: string) => void {
  const prefetch = useDiffFilePrefetch()
  return (filePath: string, base?: string): void => {
    settleBackground(prefetch(filePath, base), 'invalidation')
  }
}

/** Prefetch a file's diff (changes-list hover) so opening the diff tab feels instant. */
export function useDiffFilePrefetch(): (filePath: string, base?: string) => Promise<void> {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  return async (filePath: string, base?: string): Promise<void> => {
    if (!project) return
    if (base !== undefined) {
      await utils.gitRangeDiffFile.prefetch(
        { repoPath: project.path, base, filePath },
        { staleTime: 2000 },
      )
    } else {
      await utils.gitDiffFile.prefetch({ repoPath: project.path, filePath }, { staleTime: 2000 })
    }
  }
}

export function useCommitDiff(
  hash: string,
  filePath: string,
): { hunks: DiffHunk[] | undefined; error: { message: string } | null } {
  const project = useProjectSelectionStore((s) => s.project)
  const { data: hunks, error } = trpc.gitCommitDiff.useQuery(
    { repoPath: project?.path ?? '', hash, filePath },
    { enabled: project !== null },
  )
  return { hunks, error }
}
