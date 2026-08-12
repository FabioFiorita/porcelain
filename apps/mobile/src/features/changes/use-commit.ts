import type { CommitGroupGenerationGroup } from '@porcelain/contracts'
import { useActiveProject } from '@/features/projects'
import { usePreferencesStore } from '@/features/settings/preferences-store'
import { DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'
import {
  type CommitConventions,
  type GitSuggestion,
  gitCommitConventionsQuery,
  gitCommitMutation,
  gitDiscardFileMutation,
  gitGenerateCommitGroupsMutation,
  gitGenerateCommitMessageMutation,
  gitPushMutation,
  gitQuickCommandMutation,
  gitStageAllMutation,
  gitStageFileMutation,
  gitSuggestionsQuery,
  gitUnstageAllMutation,
  gitUnstageFileMutation,
  type QuickCommandId,
} from '@/lib/daemon/procedures/changes'
import { useDaemonInvalidate, useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'

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

/** The `type` / `scope` vocabulary this project already uses, mined from its history. */
export function useCommitConventions(): CommitConventions | undefined {
  const project = useActiveProject()
  const { data } = useDaemonQuery(gitCommitConventionsQuery, project?.path ?? '', {
    enabled: project !== null,
  })
  return data
}

/**
 * How often the git suggestion re-reads the refs behind it.
 *
 * Feature-local rather than shared: `gitSuggestions` is this card's own cache key, read from
 * nowhere else, so no other observer's interval can silently win over it.
 */
const SUGGESTIONS_POLL_MS = 5_000

/**
 * The agent-free heuristic for "the one git command worth running right now" (behind, ahead,
 * stash present, dirty tree). Polled: it is derived from refs the daemon does not watch.
 */
export function useGitSuggestions(active: boolean): GitSuggestion[] {
  const project = useActiveProject()
  const { data } = useDaemonQuery(gitSuggestionsQuery, project?.path ?? '', {
    enabled: active && project !== null,
    pollMs: SUGGESTIONS_POLL_MS,
    staleTime: 0,
  })
  return data ?? []
}

export function useStageAll(): {
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  isStaging: boolean
} {
  const project = useActiveProject()
  const stage = useDaemonMutation(gitStageAllMutation, { invalidates: STAGING_INVALIDATIONS })
  const unstage = useDaemonMutation(gitUnstageAllMutation, { invalidates: STAGING_INVALIDATIONS })
  return {
    isStaging: stage.isPending || unstage.isPending,
    stageAll: async (): Promise<void> => {
      if (project === null) return
      await stage.mutateAsync({ repoPath: project.path })
    },
    unstageAll: async (): Promise<void> => {
      if (project === null) return
      await unstage.mutateAsync({ repoPath: project.path })
    },
  }
}

export function useFileStaging(): {
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
  isStaging: boolean
} {
  const project = useActiveProject()
  const stage = useDaemonMutation(gitStageFileMutation, { invalidates: STAGING_INVALIDATIONS })
  const unstage = useDaemonMutation(gitUnstageFileMutation, { invalidates: STAGING_INVALIDATIONS })
  return {
    isStaging: stage.isPending || unstage.isPending,
    stageFile: async (path: string): Promise<void> => {
      if (project === null) return
      await stage.mutateAsync({ path, repoPath: project.path })
    },
    unstageFile: async (path: string): Promise<void> => {
      if (project === null) return
      await unstage.mutateAsync({ path, repoPath: project.path })
    },
  }
}

/** Reverts a tracked file to HEAD, or trashes a new one — the daemon decides which. */
export function useDiscardFile(): {
  discardFile: (path: string) => Promise<void>
  isDiscarding: boolean
} {
  const project = useActiveProject()
  const discard = useDaemonMutation(gitDiscardFileMutation, { invalidates: DISCARD_INVALIDATIONS })
  return {
    discardFile: async (path: string): Promise<void> => {
      if (project === null) return
      await discard.mutateAsync({ path, repoPath: project.path })
    },
    isDiscarding: discard.isPending,
  }
}

export function useCommit(): {
  commit: (message: string) => Promise<void>
  isCommitting: boolean
  error: Error | null
} {
  const project = useActiveProject()
  const mutation = useDaemonMutation(gitCommitMutation, { invalidates: COMMIT_INVALIDATIONS })
  return {
    commit: async (message: string): Promise<void> => {
      if (project === null) return
      await mutation.mutateAsync({ message, repoPath: project.path })
    },
    error: mutation.error,
    isCommitting: mutation.isPending,
  }
}

/**
 * Push the current branch — the commit's follow-through, and the only write in this tab that
 * leaves the machine. `gitPush` is the same daemon call the `push` quick command routes to, so
 * a branch with no upstream still gets tracking wired on its first push; it is exposed beside
 * Commit because that is where the need appears, not because the grid chip was missing.
 *
 * Rejects with the daemon's verbatim output so the composer's status line can print it — a push
 * that failed must never read like one that worked.
 */
export function usePush(): {
  push: () => Promise<string>
  isPushing: boolean
} {
  const project = useActiveProject()
  const mutation = useDaemonMutation(gitPushMutation, { invalidates: COMMIT_INVALIDATIONS })
  return {
    isPushing: mutation.isPending,
    push: async (): Promise<string> => {
      if (project === null) return ''
      try {
        return await mutation.mutateAsync({ repoPath: project.path })
      } catch (cause) {
        // The seam carries git's own words on `detail`; a refused push must read as git wrote it.
        throw new Error(cause instanceof DaemonError ? daemonErrorMessage(cause) : String(cause), {
          cause,
        })
      }
    },
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
  const project = useActiveProject()
  const model = usePreferencesStore((state) => state.commitModel)
  const message = useDaemonMutation(gitGenerateCommitMessageMutation)
  const groups = useDaemonMutation(gitGenerateCommitGroupsMutation)
  return {
    generateGroups: async (): Promise<CommitGroupGenerationGroup[]> => {
      if (project === null) return []
      return (await groups.mutateAsync({ model, repoPath: project.path })).groups
    },
    generateMessage: async (): Promise<string> => {
      if (project === null) return ''
      return (await message.mutateAsync({ model, repoPath: project.path })).message
    },
    isGenerating: message.isPending || groups.isPending,
  }
}

/**
 * Run one whitelisted git command and return its captured output. Pull / stash / push all
 * move project state in ways no single query covers, so everything the tab reads is invalidated.
 */
export function useQuickCommand(): {
  runCommand: (command: QuickCommandId) => Promise<string>
  isRunning: boolean
} {
  const project = useActiveProject()
  const invalidate = useDaemonInvalidate()
  const mutation = useDaemonMutation(gitQuickCommandMutation)
  return {
    isRunning: mutation.isPending,
    runCommand: async (command: QuickCommandId): Promise<string> => {
      if (project === null) return ''
      try {
        return await mutation.mutateAsync({
          command,
          // Read at call time — changing the pull strategy needn't re-render the panel.
          pullMode: usePreferencesStore.getState().pullMode,
          repoPath: project.path,
        })
      } finally {
        invalidate(COMMIT_INVALIDATIONS)
      }
    },
  }
}
