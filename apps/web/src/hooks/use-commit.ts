import type { CommitConventions } from '@backend/git/conventions'
import type { CommitGroupGenerationGroup, CommitModelOption } from '@porcelain/contracts'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useEffect } from 'react'

export function useCommit(onCommitted?: () => void): {
  commit: (message: string) => void
  isCommitting: boolean
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
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
      if (!repo) return
      mutation.mutate({ repoPath: repo.path, message })
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
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const stage = trpc.gitStageAll.useMutation({ onError: onMutationError('Stage changes') })
  const unstage = trpc.gitUnstageAll.useMutation({ onError: onMutationError('Unstage changes') })
  return {
    stageAll: async () => {
      if (!repo) return
      await stage.mutateAsync({ repoPath: repo.path })
      // gitFlow carries per-file staged/unstaged state now, so refresh it.
      await utils.gitFlow.invalidate()
    },
    unstageAll: async () => {
      if (!repo) return
      await unstage.mutateAsync({ repoPath: repo.path })
      await utils.gitFlow.invalidate()
    },
    isStaging: stage.isPending || unstage.isPending,
  }
}

/** Per-file stage/unstage from the changes list. Refreshes gitFlow after each. */
export function useFileStaging(): {
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const stage = trpc.gitStageFile.useMutation({ onError: onMutationError('Stage file') })
  const unstage = trpc.gitUnstageFile.useMutation({ onError: onMutationError('Unstage file') })
  return {
    stageFile: async (path: string): Promise<void> => {
      if (!repo) return
      await stage.mutateAsync({ repoPath: repo.path, path })
      await utils.gitFlow.invalidate()
    },
    unstageFile: async (path: string): Promise<void> => {
      if (!repo) return
      await unstage.mutateAsync({ repoPath: repo.path, path })
      await utils.gitFlow.invalidate()
    },
  }
}

/**
 * Discard a single file's changes from the changes list. Reverts a tracked file to
 * HEAD or trashes a new file (decided server-side), so it can touch the working
 * tree, the file tree, the pinned list, and the file's open diff — invalidate all.
 */
export function useDiscardFile(): (path: string) => Promise<void> {
  const repo = useRepoStore((s) => s.repo)
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
    onError: onMutationError('Discard file'),
  })
  return async (path: string): Promise<void> => {
    if (!repo) return
    await mutation.mutateAsync({ repoPath: repo.path, path })
    // The working-tree diff for this file no longer exists (reverted or trashed), so
    // its open diff tab would render a dead/errored view — close it. The Changes list
    // keys a working-tree diff tab by the bare path (no base ref).
    useTabsStore.getState().closeTabEverywhere(tabId('diff', path))
  }
}

export function useCommitConventions(): CommitConventions | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitCommitConventions.useQuery(repo?.path ?? '', { enabled: repo !== null })
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
  const repo = useRepoStore((s) => s.repo)
  const model = usePreferencesStore((s) => s.commitModel)
  const messageMutation = trpc.gitGenerateCommitMessage.useMutation()
  const groupsMutation = trpc.gitGenerateCommitGroups.useMutation()

  const generateMessage = async (): Promise<string> => {
    if (!repo) return ''
    const result = await messageMutation.mutateAsync({ repoPath: repo.path, model })
    return result.message
  }

  const generateGroups = async (): Promise<CommitGroupGenerationGroup[]> => {
    if (!repo) return []
    const result = await groupsMutation.mutateAsync({ repoPath: repo.path, model })
    return result.groups
  }

  return {
    generateMessage,
    generateGroups,
    isGenerating: messageMutation.isPending || groupsMutation.isPending,
  }
}

export function useQuickCommand(): (commandId: string) => Promise<string> {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.gitQuickCommand.useMutation()
  return async (commandId: string): Promise<string> => {
    if (!repo) return ''
    try {
      return await mutation.mutateAsync({
        repoPath: repo.path,
        command: commandId,
        // read at call-time — the pull strategy needn't re-render this hook.
        pullMode: usePreferencesStore.getState().pullMode,
      })
    } finally {
      // pull/stash/push all change repo state; refresh everything that's mounted
      await utils.invalidate()
    }
  }
}
