import type { CommitConventions } from '@backend/git/conventions'
import type {
  CommitGroupGenerationGroup,
  CommitModelOption,
  procedureCatalog,
} from '@porcelain/contracts'
import { trpc } from '@renderer/lib/trpc'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

export function useCommit(onCommitted?: () => void): {
  commit: (message: string) => void
  isCommitting: boolean
  error: { message: string } | null
} {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  const mutation = trpc.gitCommit.useMutation({
    onSuccess: async () => {
      onCommitted?.()
      await Promise.all([
        utils.gitFlow.invalidate(),
        utils.gitRangeFlow.invalidate(),
        utils.gitLog.invalidate(),
        utils.gitCommitConventions.invalidate(),
        utils.gitSuggestions.invalidate(),
        utils.reviewedPaths.invalidate(),
      ])
    },
  })
  return {
    commit: (message: string): void => {
      if (!project) return
      mutation.mutate({ repoPath: project.path, message })
    },
    isCommitting: mutation.isPending,
    error: mutation.error,
  }
}

export function useStageAll(): {
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  isStaging: boolean
} {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  // No mutation-level onError: both calls reject out to the composer, which reports
  // the failure on its status line. One owner per failure — see useFileStaging.
  const stage = trpc.gitStageAll.useMutation()
  const unstage = trpc.gitUnstageAll.useMutation()
  return {
    stageAll: async () => {
      if (!project) return
      await stage.mutateAsync({ repoPath: project.path })
      // gitFlow carries per-file staged/unstaged state now, so refresh it.
      await utils.gitFlow.invalidate()
    },
    unstageAll: async () => {
      if (!project) return
      await unstage.mutateAsync({ repoPath: project.path })
      await utils.gitFlow.invalidate()
    },
    isStaging: stage.isPending || unstage.isPending,
  }
}

/**
 * Per-file stage/unstage from the changes list. Refreshes gitFlow after each.
 *
 * These reject rather than toast: ONE owner per failure, and that owner is the edge
 * the human touched. The Changes context menu wraps each call in `runUserAction` with
 * a toast; the commit composer awaits them and reports on its status line. A
 * mutation-level `onError` here would print the same failure a second time.
 */
export function useFileStaging(): {
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
} {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  const stage = trpc.gitStageFile.useMutation()
  const unstage = trpc.gitUnstageFile.useMutation()
  return {
    stageFile: async (path: string): Promise<void> => {
      if (!project) return
      await stage.mutateAsync({ repoPath: project.path, path })
      await utils.gitFlow.invalidate()
    },
    unstageFile: async (path: string): Promise<void> => {
      if (!project) return
      await unstage.mutateAsync({ repoPath: project.path, path })
      await utils.gitFlow.invalidate()
    },
  }
}

/**
 * Discard a single file's changes from the changes list. Reverts a tracked file to
 * HEAD or trashes a new file (decided server-side), so it can touch the working
 * tree, the file tree, the pinned list, and the file's open diff — invalidate all.
 *
 * Rejects rather than toasts, for the same reason as useFileStaging: the confirm
 * dialog that triggered it owns the failure.
 */
export function useDiscardFile(): (path: string) => Promise<void> {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  const mutation = trpc.gitDiscardFile.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.gitFlow.invalidate(),
        utils.gitDiffFile.invalidate(),
        utils.readDir.invalidate(),
        utils.pinnedEntries.invalidate(),
      ])
    },
  })
  return async (path: string): Promise<void> => {
    if (!project) return
    await mutation.mutateAsync({ repoPath: project.path, path })
    // The working-tree diff for this file no longer exists (reverted or trashed), so
    // its open diff tab would render a dead/errored view — close it. The Changes list
    // keys a working-tree diff tab by the bare path (no base ref).
    useTabsStore.getState().closeTabEverywhere(tabId('diff', path))
  }
}

export function useCommitConventions(): CommitConventions | undefined {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.gitCommitConventions.useQuery(project?.path ?? '', {
    enabled: project !== null,
  })
  return data
}

export function useCommitModels(): {
  models: CommitModelOption[]
  isLoading: boolean
} {
  const commitModel = usePreferencesStore((s) => s.commitModel)
  const setCommitModel = usePreferencesStore((s) => s.setCommitModel)
  const { data, isLoading } = trpc.commitModels.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  useEffect(() => {
    const first = data?.[0]
    if (first && !data.some((model) => model.id === commitModel)) setCommitModel(first.id)
  }, [commitModel, data, setCommitModel])

  return { models: data ?? [], isLoading }
}

/**
 * Failures reject out of `generateMessage` / `generateGroups`, and the composer reports
 * them on its status line. The mutations' own `error` is deliberately NOT returned:
 * rendering both printed every failure twice, and a mutation error also lingers on
 * screen after a later attempt succeeds.
 */
export function useCommitGeneration(): {
  generateMessage: () => Promise<string>
  generateGroups: () => Promise<CommitGroupGenerationGroup[]>
  isGenerating: boolean
} {
  const project = useProjectSelectionStore((s) => s.project)
  const model = usePreferencesStore((s) => s.commitModel)
  const messageMutation = trpc.gitGenerateCommitMessage.useMutation()
  const groupsMutation = trpc.gitGenerateCommitGroups.useMutation()

  const generateMessage = async (): Promise<string> => {
    if (!project) return ''
    const result = await messageMutation.mutateAsync({ repoPath: project.path, model })
    return result.message
  }

  const generateGroups = async (): Promise<CommitGroupGenerationGroup[]> => {
    if (!project) return []
    const result = await groupsMutation.mutateAsync({ repoPath: project.path, model })
    return result.groups
  }

  return {
    generateMessage,
    generateGroups,
    isGenerating: messageMutation.isPending || groupsMutation.isPending,
  }
}

/**
 * The ids the daemon will actually run, read off the gitQuickCommand contract rather than
 * mirrored here — a button for a command outside the whitelist now fails to compile.
 */
export type QuickCommandId =
  (typeof procedureCatalog.gitQuickCommand.input.shape.command.options)[number]

export function useQuickCommand(): (commandId: QuickCommandId) => Promise<string> {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  const mutation = trpc.gitQuickCommand.useMutation()
  return async (commandId: QuickCommandId): Promise<string> => {
    if (!project) return ''
    try {
      return await mutation.mutateAsync({
        repoPath: project.path,
        command: commandId,
        // read at call-time — the pull strategy needn't re-render this hook.
        pullMode: usePreferencesStore.getState().pullMode,
      })
    } finally {
      // pull/stash/push all change project state; refresh everything that's mounted
      await utils.invalidate()
    }
  }
}
