import { type GitQueryEffect, gitMutations } from '@porcelain/client-runtime/git'
import type {
  GitAddWorktreeInput,
  GitCheckoutInput,
  GitCreateBranchInput,
  Worktree,
} from '@porcelain/contracts/git'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateGitEffects } from '../git-query-filter'

type GitWorkspaceInput = GitCheckoutInput | GitCreateBranchInput | GitAddWorktreeInput

export type GitMutationAction<TOutput> = {
  mutateAsync: (branch: string) => Promise<TOutput | undefined>
  isPending: boolean
}

function useGitWorkspaceMutation<TInput extends GitWorkspaceInput, TOutput>(
  execute: (input: TInput) => Promise<TOutput>,
  affectedQueries: (input: TInput) => readonly GitQueryEffect[],
): {
  mutation: UseMutationResult<TOutput, Error, TInput>
  repoPath: string | null
  daemon: DaemonScope
} {
  const project = useProjectSelectionStore((state) => state.project)
  const daemonIdentity = useDaemonIdentity()
  const daemon: DaemonScope = { host: daemonIdentity.host, version: daemonIdentity.version }
  const queryClient = useQueryClient()
  const mutation = useMutation<TOutput, Error, TInput>({
    mutationFn: execute,
    onSuccess: async (_value, input): Promise<void> => {
      await invalidateGitEffects(queryClient, daemon, affectedQueries(input))
    },
  })

  return { daemon, mutation, repoPath: project?.path ?? null }
}

export function useGitCheckout(): GitMutationAction<void> {
  const utils = trpc.useUtils()
  const { mutation, repoPath } = useGitWorkspaceMutation<GitCheckoutInput, void>(
    (input) => utils.client.gitCheckout.mutate(input),
    (input) => gitMutations.checkout.affectedQueries(input),
  )

  return {
    isPending: mutation.isPending,
    mutateAsync: (branch) =>
      repoPath === null ? Promise.resolve(undefined) : mutation.mutateAsync({ repoPath, branch }),
  }
}

export function useGitCreateBranch(): GitMutationAction<void> {
  const utils = trpc.useUtils()
  const { mutation, repoPath } = useGitWorkspaceMutation<GitCreateBranchInput, void>(
    (input) => utils.client.gitCreateBranch.mutate(input),
    (input) => gitMutations.createBranch.affectedQueries(input),
  )

  return {
    isPending: mutation.isPending,
    mutateAsync: (branch) =>
      repoPath === null ? Promise.resolve(undefined) : mutation.mutateAsync({ repoPath, branch }),
  }
}

export function useGitAddWorktree(): GitMutationAction<Worktree> {
  const utils = trpc.useUtils()
  const { mutation, repoPath } = useGitWorkspaceMutation<GitAddWorktreeInput, Worktree>(
    (input) => utils.client.gitAddWorktree.mutate(input),
    (input) => gitMutations.addWorktree.affectedQueries(input),
  )

  return {
    isPending: mutation.isPending,
    mutateAsync: (branch): Promise<Worktree | undefined> =>
      repoPath === null ? Promise.resolve(undefined) : mutation.mutateAsync({ repoPath, branch }),
  }
}
