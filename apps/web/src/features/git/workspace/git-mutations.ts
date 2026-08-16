import { type GitQueryEffect, gitMutations } from '@porcelain/client-runtime/git'
import type {
  GitAddWorktreeInput,
  GitCheckoutInput,
  GitCreateBranchInput,
  Worktree,
} from '@porcelain/contracts/git'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { type EnvironmentClient, environmentClientFor } from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath, useHubRepoTarget } from '@renderer/stores/hub-repo'
import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateGitEffects } from '../git-query-filter'

type GitWorkspaceInput = GitCheckoutInput | GitCreateBranchInput | GitAddWorktreeInput

export type GitMutationAction<TOutput> = {
  mutateAsync: (branch: string) => Promise<TOutput | undefined>
  isPending: boolean
}

function useGitWorkspaceMutation<TInput extends GitWorkspaceInput, TOutput>(
  execute: (client: EnvironmentClient['client'], input: TInput) => Promise<TOutput>,
  affectedQueries: (input: TInput) => readonly GitQueryEffect[],
): {
  mutation: UseMutationResult<TOutput, Error, TInput>
  repoPath: string | null
  daemon: DaemonScope
} {
  const repoPath = useHubRepoPath()
  const target = useHubRepoTarget()
  const daemonIdentity = useDaemonIdentity()
  const daemon: DaemonScope = {
    host: target?.environmentId ?? daemonIdentity.host,
    version: daemonIdentity.version,
  }
  const utils = trpc.useUtils()
  const owner =
    target === null && repoPath !== null
      ? { client: utils.client }
      : environmentClientFor(target?.environmentId ?? null, utils.client)
  const queryClient = useQueryClient()
  const mutation = useMutation<TOutput, Error, TInput>({
    mutationFn: async (input): Promise<TOutput> => {
      if (owner === null) throw new Error('The target Environment is offline.')
      return execute(owner.client, input)
    },
    onSuccess: async (_value, input): Promise<void> => {
      await invalidateGitEffects(queryClient, daemon, affectedQueries(input))
    },
  })

  return { daemon, mutation, repoPath }
}

export function useGitCheckout(): GitMutationAction<void> {
  const { mutation, repoPath } = useGitWorkspaceMutation<GitCheckoutInput, void>(
    (client, input) => client.gitCheckout.mutate(input),
    (input) => gitMutations.checkout.affectedQueries(input),
  )

  return {
    isPending: mutation.isPending,
    mutateAsync: (branch) =>
      repoPath === null ? Promise.resolve(undefined) : mutation.mutateAsync({ repoPath, branch }),
  }
}

export function useGitCreateBranch(): GitMutationAction<void> {
  const { mutation, repoPath } = useGitWorkspaceMutation<GitCreateBranchInput, void>(
    (client, input) => client.gitCreateBranch.mutate(input),
    (input) => gitMutations.createBranch.affectedQueries(input),
  )

  return {
    isPending: mutation.isPending,
    mutateAsync: (branch) =>
      repoPath === null ? Promise.resolve(undefined) : mutation.mutateAsync({ repoPath, branch }),
  }
}

export function useGitAddWorktree(): GitMutationAction<Worktree> {
  const { mutation, repoPath } = useGitWorkspaceMutation<GitAddWorktreeInput, Worktree>(
    (client, input) => client.gitAddWorktree.mutate(input),
    (input) => gitMutations.addWorktree.affectedQueries(input),
  )

  return {
    isPending: mutation.isPending,
    mutateAsync: (branch): Promise<Worktree | undefined> =>
      repoPath === null ? Promise.resolve(undefined) : mutation.mutateAsync({ repoPath, branch }),
  }
}
