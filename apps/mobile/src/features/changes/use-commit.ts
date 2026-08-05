import type { CommitGroupGenerationGroup } from '@porcelain/contracts'

import { usePreferencesStore } from '@/features/settings/preferences-store'
import {
  type CommitConventions,
  type GitSuggestion,
  gitCommitConventionsQuery,
  gitCommitMutation,
  gitDiscardFileMutation,
  gitGenerateCommitGroupsMutation,
  gitGenerateCommitMessageMutation,
  gitQuickCommandMutation,
  gitStageAllMutation,
  gitStageFileMutation,
  gitSuggestionsQuery,
  gitUnstageAllMutation,
  gitUnstageFileMutation,
  type QuickCommandId,
} from '@/lib/daemon/procedures/changes'
import { useDaemonInvalidate, useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

/** Staging edits the index, which every changed-file read is derived from. */
const STAGING_INVALIDATIONS = ['gitFlow', 'gitDiffFile', 'diffReading', 'gitSuggestions'] as const

/** A commit rewrites HEAD: the range, the log, the conventions vocabulary and the marks all move. */
const COMMIT_INVALIDATIONS = [
  'gitFlow',
  'gitRangeFlow',
  'gitDiffFile',
  'gitRangeDiffFile',
  'diffReading',
  'gitLog',
  'gitHead',
  'gitCommitConventions',
  'gitSuggestions',
  'reviewedPaths',
] as const

/** Discarding can trash a file outright, so the tree and the pinned list move with it. */
const DISCARD_INVALIDATIONS = [
  'gitFlow',
  'gitDiffFile',
  'diffReading',
  'readDir',
  'pinnedEntries',
] as const

/** The `type` / `scope` vocabulary this repo already uses, mined from its history. */
export function useCommitConventions(): CommitConventions | undefined {
  const repo = useActiveRepo()
  const { data } = useDaemonQuery(gitCommitConventionsQuery, repo?.path ?? '', {
    enabled: repo !== null,
  })
  return data
}

/**
 * The agent-free heuristic for "the one git command worth running right now" (behind, ahead,
 * stash present, dirty tree). Polled: it is derived from refs the daemon does not watch.
 */
export function useGitSuggestions(active: boolean): GitSuggestion[] {
  const repo = useActiveRepo()
  const { data } = useDaemonQuery(gitSuggestionsQuery, repo?.path ?? '', {
    enabled: active && repo !== null,
    pollMs: 5_000,
    staleTime: 0,
  })
  return data ?? []
}

export function useStageAll(): {
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  isStaging: boolean
} {
  const repo = useActiveRepo()
  const stage = useDaemonMutation(gitStageAllMutation, { invalidates: STAGING_INVALIDATIONS })
  const unstage = useDaemonMutation(gitUnstageAllMutation, { invalidates: STAGING_INVALIDATIONS })
  return {
    isStaging: stage.isPending || unstage.isPending,
    stageAll: async (): Promise<void> => {
      if (repo === null) return
      await stage.mutateAsync({ repoPath: repo.path })
    },
    unstageAll: async (): Promise<void> => {
      if (repo === null) return
      await unstage.mutateAsync({ repoPath: repo.path })
    },
  }
}

export function useFileStaging(): {
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
  isStaging: boolean
} {
  const repo = useActiveRepo()
  const stage = useDaemonMutation(gitStageFileMutation, { invalidates: STAGING_INVALIDATIONS })
  const unstage = useDaemonMutation(gitUnstageFileMutation, { invalidates: STAGING_INVALIDATIONS })
  return {
    isStaging: stage.isPending || unstage.isPending,
    stageFile: async (path: string): Promise<void> => {
      if (repo === null) return
      await stage.mutateAsync({ path, repoPath: repo.path })
    },
    unstageFile: async (path: string): Promise<void> => {
      if (repo === null) return
      await unstage.mutateAsync({ path, repoPath: repo.path })
    },
  }
}

/** Reverts a tracked file to HEAD, or trashes a new one — the daemon decides which. */
export function useDiscardFile(): {
  discardFile: (path: string) => Promise<void>
  isDiscarding: boolean
} {
  const repo = useActiveRepo()
  const discard = useDaemonMutation(gitDiscardFileMutation, { invalidates: DISCARD_INVALIDATIONS })
  return {
    discardFile: async (path: string): Promise<void> => {
      if (repo === null) return
      await discard.mutateAsync({ path, repoPath: repo.path })
    },
    isDiscarding: discard.isPending,
  }
}

export function useCommit(): {
  commit: (message: string) => Promise<void>
  isCommitting: boolean
  error: Error | null
} {
  const repo = useActiveRepo()
  const mutation = useDaemonMutation(gitCommitMutation, { invalidates: COMMIT_INVALIDATIONS })
  return {
    commit: async (message: string): Promise<void> => {
      if (repo === null) return
      await mutation.mutateAsync({ message, repoPath: repo.path })
    },
    error: mutation.error,
    isCommitting: mutation.isPending,
  }
}

/**
 * Both generators reject on failure and the composer prints the reason on its status line;
 * the mutations' own `error` is deliberately not returned, or a failure would render twice
 * and linger after a later attempt succeeded.
 */
export function useCommitGeneration(): {
  generateMessage: () => Promise<string>
  generateGroups: () => Promise<CommitGroupGenerationGroup[]>
  isGenerating: boolean
} {
  const repo = useActiveRepo()
  const model = usePreferencesStore((state) => state.commitModel)
  const message = useDaemonMutation(gitGenerateCommitMessageMutation)
  const groups = useDaemonMutation(gitGenerateCommitGroupsMutation)
  return {
    generateGroups: async (): Promise<CommitGroupGenerationGroup[]> => {
      if (repo === null) return []
      return (await groups.mutateAsync({ model, repoPath: repo.path })).groups
    },
    generateMessage: async (): Promise<string> => {
      if (repo === null) return ''
      return (await message.mutateAsync({ model, repoPath: repo.path })).message
    },
    isGenerating: message.isPending || groups.isPending,
  }
}

/**
 * Run one whitelisted git command and return its captured output. Pull / stash / push all
 * move repo state in ways no single query covers, so everything the tab reads is invalidated.
 */
export function useQuickCommand(): {
  runCommand: (command: QuickCommandId) => Promise<string>
  isRunning: boolean
} {
  const repo = useActiveRepo()
  const invalidate = useDaemonInvalidate()
  const mutation = useDaemonMutation(gitQuickCommandMutation)
  return {
    isRunning: mutation.isPending,
    runCommand: async (command: QuickCommandId): Promise<string> => {
      if (repo === null) return ''
      try {
        return await mutation.mutateAsync({
          command,
          // Read at call time — changing the pull strategy needn't re-render the panel.
          pullMode: usePreferencesStore.getState().pullMode,
          repoPath: repo.path,
        })
      } finally {
        invalidate(COMMIT_INVALIDATIONS)
      }
    },
  }
}
