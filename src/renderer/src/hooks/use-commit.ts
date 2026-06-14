import type { CommitConventions } from '@main/conventions'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

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
        utils.gitLog.invalidate(),
        utils.gitCommitConventions.invalidate(),
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

export function useStageAll(): {
  stageAll: () => Promise<void>
  isStaging: boolean
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.gitStageAll.useMutation()
  return {
    stageAll: async () => {
      if (!repo) return
      await mutation.mutateAsync({ repoPath: repo.path })
      // gitFlow carries per-file staged/unstaged state now, so refresh it.
      await utils.gitFlow.invalidate()
    },
    isStaging: mutation.isPending,
  }
}

/** Per-file stage/unstage from the changes list. Refreshes gitFlow after each. */
export function useFileStaging(): {
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const stage = trpc.gitStageFile.useMutation()
  const unstage = trpc.gitUnstageFile.useMutation()
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
      return await mutation.mutateAsync({ repoPath: repo.path, command: commandId })
    } finally {
      // pull/stash/push all change repo state; refresh everything that's mounted
      await utils.invalidate()
    }
  }
}
