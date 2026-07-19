import type { CommitConventions } from '@backend/conventions'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'

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
    commit: (message) => {
      if (!repo) return
      mutation.mutate({ repoPath: repo.path, message })
    },
    isCommitting: mutation.isPending,
    error: mutation.error,
  }
}

/** Push the current branch (wiring upstream on first push); returns git's merged output. */
export function usePush(): {
  push: () => Promise<string>
  isPushing: boolean
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.gitPush.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.gitSuggestions.invalidate(), utils.gitLog.invalidate()])
    },
  })
  return {
    push: async () => {
      if (!repo) return ''
      return mutation.mutateAsync({ repoPath: repo.path })
    },
    isPushing: mutation.isPending,
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
    stageFile: async (path) => {
      if (!repo) return
      await stage.mutateAsync({ repoPath: repo.path, path })
      await utils.gitFlow.invalidate()
    },
    unstageFile: async (path) => {
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
  return async (path) => {
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

export function useQuickCommand(): (commandId: string) => Promise<string> {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.gitQuickCommand.useMutation()
  return async (commandId) => {
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
