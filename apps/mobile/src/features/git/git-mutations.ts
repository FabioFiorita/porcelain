import type { FilesQueryEffect } from '@porcelain/client-runtime/files'
import {
  type GitQueryEffect,
  gitDiffReadingQueryFamily,
  gitFlowQuery,
  gitMutations as gitMutationSemantics,
  gitProjectKey,
  gitRangeFlowQuery,
} from '@porcelain/client-runtime/git'
import type { CommitGroupGenerationGroup } from '@porcelain/contracts'
import type { CommitGroupResult, GitQuickCommandInput } from '@porcelain/contracts/git'
import { gitProcedures } from '@porcelain/contracts/git'
import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { invalidateFilesEffects } from '@/features/files'
import { isPaired } from '@/features/remote'
import { usePreferencesStore } from '@/features/settings/preferences-store'
import { DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'
import { type DaemonProcedure, namedContractProcedure } from '@/lib/daemon/procedure'

import { invalidateGitEffects } from './git-query-filter'
import { callGit, useGitScope } from './use-git-transport'

/** The whitelisted commands the grid offers, in the order it shows them. */
export type QuickCommandId = GitQuickCommandInput['command']

export const QUICK_COMMANDS = [
  'status',
  'pull',
  'push',
  'fetch',
  'stash',
  'stash-pop',
] as const satisfies readonly QuickCommandId[]

const stageAllProcedure = namedContractProcedure('gitStageAll', gitProcedures.gitStageAll)
const unstageAllProcedure = namedContractProcedure('gitUnstageAll', gitProcedures.gitUnstageAll)
const stageFileProcedure = namedContractProcedure('gitStageFile', gitProcedures.gitStageFile)
const unstageFileProcedure = namedContractProcedure('gitUnstageFile', gitProcedures.gitUnstageFile)
const discardFileProcedure = namedContractProcedure('gitDiscardFile', gitProcedures.gitDiscardFile)
const commitProcedure = namedContractProcedure('gitCommit', gitProcedures.gitCommit)
const pushProcedure = namedContractProcedure('gitPush', gitProcedures.gitPush)
const generateMessageProcedure = namedContractProcedure(
  'gitGenerateCommitMessage',
  gitProcedures.gitGenerateCommitMessage,
)
const generateGroupsProcedure = namedContractProcedure(
  'gitGenerateCommitGroups',
  gitProcedures.gitGenerateCommitGroups,
)
const applyCommitGroupsProcedure = namedContractProcedure(
  'gitApplyCommitGroups',
  gitProcedures.gitApplyCommitGroups,
)
const quickCommandProcedure = namedContractProcedure(
  'gitQuickCommand',
  gitProcedures.gitQuickCommand,
)

type GitWriteConsequences<TInput> = {
  readonly affectedQueries: (input: TInput) => readonly GitQueryEffect[]
  readonly filesEffects: (input: TInput) => readonly FilesQueryEffect[]
}

/**
 * One Git write, with its authoritative consequences.
 *
 * Nothing is painted optimistically: the daemon is the only source of Git truth, so the effect
 * sets are invalidated after success and awaited, and a failure leaves the cache untouched for
 * the caller to report.
 */
function useGitWrite<TInput, TOutput>(
  procedure: DaemonProcedure<TInput, TOutput>,
  consequences: GitWriteConsequences<TInput>,
): UseMutationResult<TOutput, DaemonError, TInput> {
  const { environment } = useGitScope()
  const queryClient = useQueryClient()

  return useMutation<TOutput, DaemonError, TInput>({
    mutationFn: (input): Promise<TOutput> => callGit(environment, procedure, input),
    onSuccess: async (_output, input): Promise<void> => {
      if (!isPaired(environment)) return
      await invalidateGitEffects(queryClient, environment.id, consequences.affectedQueries(input))
      const files = consequences.filesEffects(input)
      if (files.length > 0) await invalidateFilesEffects(queryClient, environment.id, files)
    },
  })
}

export function useStageAll(): {
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  isStaging: boolean
} {
  const { ready, repoPath } = useGitScope()
  const stage = useGitWrite(stageAllProcedure, gitMutationSemantics.stageAll)
  const unstage = useGitWrite(unstageAllProcedure, gitMutationSemantics.unstageAll)
  return {
    isStaging: stage.isPending || unstage.isPending,
    stageAll: async (): Promise<void> => {
      if (!ready) return
      await stage.mutateAsync({ repoPath })
    },
    unstageAll: async (): Promise<void> => {
      if (!ready) return
      await unstage.mutateAsync({ repoPath })
    },
  }
}

export function useFileStaging(): {
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
  isStaging: boolean
} {
  const { ready, repoPath } = useGitScope()
  const stage = useGitWrite(stageFileProcedure, gitMutationSemantics.stageFile)
  const unstage = useGitWrite(unstageFileProcedure, gitMutationSemantics.unstageFile)
  return {
    isStaging: stage.isPending || unstage.isPending,
    stageFile: async (path: string): Promise<void> => {
      if (!ready) return
      await stage.mutateAsync({ path, repoPath })
    },
    unstageFile: async (path: string): Promise<void> => {
      if (!ready) return
      await unstage.mutateAsync({ path, repoPath })
    },
  }
}

/**
 * Reverts a tracked file to HEAD, or trashes a new one — the daemon decides which. The file
 * tree and the pinned list move with it, through the Files feature's own typed effects.
 */
export function useDiscardFile(): {
  discardFile: (path: string) => Promise<void>
  isDiscarding: boolean
} {
  const { ready, repoPath } = useGitScope()
  const discard = useGitWrite(discardFileProcedure, gitMutationSemantics.discardFile)
  return {
    discardFile: async (path: string): Promise<void> => {
      if (!ready) return
      await discard.mutateAsync({ path, repoPath })
    },
    isDiscarding: discard.isPending,
  }
}

export function useCommit(): {
  commit: (message: string) => Promise<void>
  isCommitting: boolean
  error: Error | null
} {
  const { ready, repoPath } = useGitScope()
  const mutation = useGitWrite(commitProcedure, gitMutationSemantics.commit)
  return {
    commit: async (message: string): Promise<void> => {
      if (!ready) return
      await mutation.mutateAsync({ message, repoPath })
    },
    error: mutation.error,
    isCommitting: mutation.isPending,
  }
}

/**
 * Push the current branch — the commit's follow-through, and the only write in this tab that
 * leaves the machine.
 *
 * Rejects with the daemon's verbatim output so the composer's status line can print it — a push
 * that failed must never read like one that worked.
 */
export function usePush(): {
  push: () => Promise<string>
  isPushing: boolean
} {
  const { ready, repoPath } = useGitScope()
  const mutation = useGitWrite(pushProcedure, gitMutationSemantics.push)
  return {
    isPushing: mutation.isPending,
    push: async (): Promise<string> => {
      if (!ready) return ''
      try {
        return await mutation.mutateAsync({ repoPath })
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
  const { ready, repoPath } = useGitScope()
  const model = usePreferencesStore((state) => state.commitModel)
  const message = useGitWrite(generateMessageProcedure, gitMutationSemantics.generateMessage)
  const groups = useGitWrite(generateGroupsProcedure, gitMutationSemantics.generateGroups)
  return {
    generateGroups: async (): Promise<CommitGroupGenerationGroup[]> => {
      if (!ready) return []
      return (await groups.mutateAsync({ model, repoPath })).groups
    },
    generateMessage: async (): Promise<string> => {
      if (!ready) return ''
      return (await message.mutateAsync({ model, repoPath })).message
    },
    isGenerating: message.isPending || groups.isPending,
  }
}

/**
 * Accept a whole grouped proposal: the daemon stages and commits every group in order, in ONE
 * round trip, so a mid-way failure is decided in one place instead of across N client calls.
 *
 * It resolves even when a group fails — the per-group results say which landed — so the caller
 * renders the outcome rather than catching an error. The commit effects are invalidated either
 * way, because any group that did commit has already moved the working tree and the history.
 */
export function useApplyCommitGroups(): {
  applyGroups: (groups: readonly CommitGroupGenerationGroup[]) => Promise<CommitGroupResult[]>
  isApplying: boolean
} {
  const { ready, repoPath } = useGitScope()
  const mutation = useGitWrite(applyCommitGroupsProcedure, gitMutationSemantics.applyGroups)
  return {
    applyGroups: async (
      groups: readonly CommitGroupGenerationGroup[],
    ): Promise<CommitGroupResult[]> => {
      if (!ready || groups.length === 0) return []
      return (await mutation.mutateAsync({ groups: [...groups], repoPath })).results
    },
    isApplying: mutation.isPending,
  }
}

/**
 * Run one whitelisted git command and return its captured output. Each command declares the
 * reads it actually moves — `status` moves none at all — instead of flushing the tab.
 */
export function useQuickCommand(): {
  runCommand: (command: QuickCommandId) => Promise<string>
  isRunning: boolean
} {
  const { ready, repoPath } = useGitScope()
  const mutation = useGitWrite(quickCommandProcedure, gitMutationSemantics.quickCommand)
  return {
    isRunning: mutation.isPending,
    runCommand: async (command: QuickCommandId): Promise<string> => {
      if (!ready) return ''
      return mutation.mutateAsync({
        command,
        // Read at call time — changing the pull strategy needn't re-render the panel.
        pullMode: usePreferencesStore.getState().pullMode,
        repoPath,
      })
    },
  }
}

/**
 * Regrouping — a layer edit or a companion-visibility flip — leaves every flow read stale
 * without changing a single commit. Settings owns the write; the freshness stays typed here.
 */
export function useInvalidateGitGrouping(): (repoPath: string) => Promise<void> {
  const { environment } = useGitScope()
  const queryClient = useQueryClient()

  return useCallback(
    (repoPath: string): Promise<void> => {
      if (!isPaired(environment)) return Promise.resolve()
      const projectKey = gitProjectKey(repoPath)
      return invalidateGitEffects(queryClient, environment.id, [
        gitFlowQuery(projectKey),
        gitRangeFlowQuery(projectKey),
        gitDiffReadingQueryFamily(projectKey),
      ])
    },
    [environment, queryClient],
  )
}
