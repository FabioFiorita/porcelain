import { type GitQueryEffect, gitMutations } from '@porcelain/client-runtime/git'
import type { CommitGroupGenerationGroup, procedureCatalog } from '@porcelain/contracts'
import type {
  GitCommitInput,
  GitGenerateCommitGroupsInput,
  GitGenerateCommitMessageInput,
  GitPushInput,
  GitQuickCommandInput,
  GitStageAllInput,
  GitStageFileInput,
  GitUnstageAllInput,
  GitUnstageFileInput,
} from '@porcelain/contracts/git'
import { invalidateFilesEffects } from '@renderer/features/files'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateGitEffects } from './git-query-filter'

/**
 * Web Git write adapter.
 *
 * Every write binds `gitMutations` (non-optimistic, authoritative refetch) and applies its exact
 * typed consequences — Git effects through the semantic filter, Files effects through the Files
 * feature filter. Staging, discard, commit, push, and generation failures REJECT to the caller;
 * no hook here toasts, because the edge the human touched owns the failure.
 */

function daemonScope(identity: { host: string | null; version: string | null }): DaemonScope {
  return { host: identity.host, version: identity.version }
}

async function invalidateMutationEffects(
  queryClient: ReturnType<typeof useQueryClient>,
  daemon: DaemonScope,
  effects: readonly GitQueryEffect[],
  filesEffects: Parameters<typeof invalidateFilesEffects>[2],
): Promise<void> {
  await invalidateGitEffects(queryClient, daemon, effects)
  if (filesEffects.length > 0) await invalidateFilesEffects(queryClient, daemon, filesEffects)
}

/** Commit the staged tree. The composer renders `error` on its status line; no toast here. */
export function useCommit(onCommitted?: () => void): {
  commit: (message: string) => void
  isCommitting: boolean
  error: { message: string } | null
} {
  const project = useProjectSelectionStore((state) => state.project)
  const identity = useDaemonIdentity()
  const daemon = daemonScope(identity)
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const mutation = useMutation<void, Error, GitCommitInput>({
    mutationFn: (input) => utils.client.gitCommit.mutate(input),
    onSuccess: async (_value, input): Promise<void> => {
      onCommitted?.()
      await invalidateMutationEffects(
        queryClient,
        daemon,
        gitMutations.commit.affectedQueries(input),
        gitMutations.commit.filesEffects(input),
      )
    },
  })
  return {
    commit: (message: string): void => {
      if (project === null) return
      mutation.mutate({ message, repoPath: project.path })
    },
    error: mutation.error,
    isCommitting: mutation.isPending,
  }
}

function useGitVoidMutation<TInput>(
  execute: (input: TInput) => Promise<void>,
  affectedQueries: (input: TInput) => readonly GitQueryEffect[],
  filesEffects: (input: TInput) => Parameters<typeof invalidateFilesEffects>[2],
): {
  run: (input: TInput) => Promise<void>
  isPending: boolean
} {
  const identity = useDaemonIdentity()
  const daemon = daemonScope(identity)
  const queryClient = useQueryClient()
  const mutation = useMutation<void, Error, TInput>({
    mutationFn: execute,
    onSuccess: async (_value, input): Promise<void> => {
      await invalidateMutationEffects(
        queryClient,
        daemon,
        affectedQueries(input),
        filesEffects(input),
      )
    },
  })
  return { isPending: mutation.isPending, run: mutation.mutateAsync }
}

/** Stage / unstage the whole tree. Rejects to the composer; gitFlow carries staged state. */
export function useStageAll(): {
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  isStaging: boolean
} {
  const project = useProjectSelectionStore((state) => state.project)
  const utils = trpc.useUtils()
  const stage = useGitVoidMutation<GitStageAllInput>(
    (input) => utils.client.gitStageAll.mutate(input),
    gitMutations.stageAll.affectedQueries,
    gitMutations.stageAll.filesEffects,
  )
  const unstage = useGitVoidMutation<GitUnstageAllInput>(
    (input) => utils.client.gitUnstageAll.mutate(input),
    gitMutations.unstageAll.affectedQueries,
    gitMutations.unstageAll.filesEffects,
  )
  return {
    isStaging: stage.isPending || unstage.isPending,
    stageAll: async (): Promise<void> => {
      if (project === null) return
      await stage.run({ repoPath: project.path })
    },
    unstageAll: async (): Promise<void> => {
      if (project === null) return
      await unstage.run({ repoPath: project.path })
    },
  }
}

/**
 * Per-file stage/unstage from the changes list.
 *
 * These reject rather than toast: ONE owner per failure, and that owner is the edge the human
 * touched. The Changes context menu wraps each call in `runUserAction` with a toast; the commit
 * composer awaits them and reports on its status line.
 */
export function useFileStaging(): {
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
  isStaging: boolean
} {
  const project = useProjectSelectionStore((state) => state.project)
  const utils = trpc.useUtils()
  const stage = useGitVoidMutation<GitStageFileInput>(
    (input) => utils.client.gitStageFile.mutate(input),
    gitMutations.stageFile.affectedQueries,
    gitMutations.stageFile.filesEffects,
  )
  const unstage = useGitVoidMutation<GitUnstageFileInput>(
    (input) => utils.client.gitUnstageFile.mutate(input),
    gitMutations.unstageFile.affectedQueries,
    gitMutations.unstageFile.filesEffects,
  )
  return {
    isStaging: stage.isPending || unstage.isPending,
    stageFile: async (path: string): Promise<void> => {
      if (project === null) return
      await stage.run({ path, repoPath: project.path })
    },
    unstageFile: async (path: string): Promise<void> => {
      if (project === null) return
      await unstage.run({ path, repoPath: project.path })
    },
  }
}

/**
 * Discard one file's changes. Reverts a tracked file to HEAD or trashes a new file (decided
 * server-side), so it applies the Git working-tree effects AND the typed Files tree/pins effects.
 * The file's working-tree diff no longer exists, so its open diff tab is closed. Rejects rather
 * than toasts — the confirm dialog that triggered it owns the failure.
 */
export function useDiscardFile(): (path: string) => Promise<void> {
  const project = useProjectSelectionStore((state) => state.project)
  const utils = trpc.useUtils()
  const discard = useGitVoidMutation<{ repoPath: string; path: string }>(
    (input) => utils.client.gitDiscardFile.mutate(input),
    gitMutations.discardFile.affectedQueries,
    gitMutations.discardFile.filesEffects,
  )
  return async (path: string): Promise<void> => {
    if (project === null) return
    await discard.run({ path, repoPath: project.path })
    useTabsStore.getState().closeTabEverywhere(tabId('diff', path))
  }
}

/** Push the current branch; resolves to the daemon's output line. */
export function usePush(): {
  push: () => Promise<string>
  isPushing: boolean
} {
  const project = useProjectSelectionStore((state) => state.project)
  const identity = useDaemonIdentity()
  const daemon = daemonScope(identity)
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const mutation = useMutation<string, Error, GitPushInput>({
    mutationFn: (input) => utils.client.gitPush.mutate(input),
    onSuccess: async (_value, input): Promise<void> => {
      await invalidateMutationEffects(
        queryClient,
        daemon,
        gitMutations.push.affectedQueries(input),
        gitMutations.push.filesEffects(input),
      )
    },
  })
  return {
    isPushing: mutation.isPending,
    push: async (): Promise<string> => {
      if (project === null) return ''
      return mutation.mutateAsync({ repoPath: project.path })
    },
  }
}

/**
 * Failures reject out of `generateMessage` / `generateGroups`, and the composer reports them on
 * its status line. The mutations' own `error` is deliberately NOT returned: rendering both
 * printed every failure twice, and a mutation error also lingered on screen after a later
 * attempt succeeded.
 */
export function useCommitGeneration(): {
  generateMessage: () => Promise<string>
  generateGroups: () => Promise<CommitGroupGenerationGroup[]>
  isGenerating: boolean
} {
  const project = useProjectSelectionStore((state) => state.project)
  const model = usePreferencesStore((state) => state.commitModel)
  const utils = trpc.useUtils()
  const message = useMutation({
    mutationFn: (input: GitGenerateCommitMessageInput) =>
      utils.client.gitGenerateCommitMessage.mutate(input),
  })
  const groups = useMutation({
    mutationFn: (input: GitGenerateCommitGroupsInput) =>
      utils.client.gitGenerateCommitGroups.mutate(input),
  })
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
 * The ids the daemon will actually run, read off the gitQuickCommand contract rather than
 * mirrored here — a button for a command outside the whitelist now fails to compile.
 */
export type QuickCommandId =
  (typeof procedureCatalog.gitQuickCommand.input.shape.command.options)[number]

/** Quick command with the contract's per-command effects — never a broad cache flush. */
export function useQuickCommand(): (commandId: QuickCommandId) => Promise<string> {
  const project = useProjectSelectionStore((state) => state.project)
  const identity = useDaemonIdentity()
  const daemon = daemonScope(identity)
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const mutation = useMutation<string, Error, GitQuickCommandInput>({
    mutationFn: (input) => utils.client.gitQuickCommand.mutate(input),
    onSuccess: async (_value, input): Promise<void> => {
      await invalidateMutationEffects(
        queryClient,
        daemon,
        gitMutations.quickCommand.affectedQueries(input),
        gitMutations.quickCommand.filesEffects(input),
      )
    },
  })
  return async (commandId: QuickCommandId): Promise<string> => {
    if (project === null) return ''
    return mutation.mutateAsync({
      command: commandId,
      pullMode: usePreferencesStore.getState().pullMode,
      repoPath: project.path,
    })
  }
}
