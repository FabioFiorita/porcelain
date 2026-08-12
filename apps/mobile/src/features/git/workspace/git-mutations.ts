import { type GitWorkspaceQuery, gitWorkspaceMutations } from '@porcelain/client-runtime/git'
import {
  type GitAddWorktreeInput,
  type GitCheckoutInput,
  type GitCreateBranchInput,
  gitProcedures,
  type Worktree,
} from '@porcelain/contracts/git'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useActiveProject } from '@/features/projects'
import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { DaemonError } from '@/lib/daemon/errors'
import { type DaemonProcedure, namedContractProcedure } from '@/lib/daemon/procedure'
import { invalidateGitEffects } from './git-legacy-cache'
import { callGitMutation } from './use-git-mutations'

type GitWorkspaceInput = GitCheckoutInput | GitCreateBranchInput | GitAddWorktreeInput

export type GitMutationAction<TOutput> = {
  mutateAsync: (branch: string) => Promise<TOutput | undefined>
  isPending: boolean
}

function useGitWorkspaceMutation<TOutput>(
  procedure: DaemonProcedure<GitWorkspaceInput, TOutput>,
  affectedQueries: (input: GitWorkspaceInput) => readonly GitWorkspaceQuery[],
): GitMutationAction<TOutput> {
  const environment = useActiveEnvironment()
  const project = useActiveProject()
  const queryClient = useQueryClient()
  const mutation = useMutation<TOutput, DaemonError, GitWorkspaceInput>({
    mutationFn: async (input): Promise<TOutput> => {
      if (!isPaired(environment)) {
        throw new DaemonError(
          'unreachable',
          procedure.name,
          'No daemon is paired with this device.',
        )
      }
      return callGitMutation(environment, procedure, input)
    },
    onSuccess: async (_value, input): Promise<void> => {
      if (!isPaired(environment)) return
      await invalidateGitEffects(queryClient, environment.id, affectedQueries(input))
    },
  })

  return {
    isPending: mutation.isPending,
    mutateAsync: (branch): Promise<TOutput | undefined> =>
      project === null
        ? Promise.resolve(undefined)
        : mutation.mutateAsync({ branch, repoPath: project.path }),
  }
}

const checkoutProcedure = namedContractProcedure('gitCheckout', gitProcedures.gitCheckout)
const createBranchProcedure = namedContractProcedure(
  'gitCreateBranch',
  gitProcedures.gitCreateBranch,
)
const addWorktreeProcedure = namedContractProcedure('gitAddWorktree', gitProcedures.gitAddWorktree)

export function useGitCheckout(): GitMutationAction<void> {
  return useGitWorkspaceMutation(checkoutProcedure, (input) =>
    gitWorkspaceMutations.checkout.affectedQueries(input),
  )
}

export function useGitCreateBranch(): GitMutationAction<void> {
  return useGitWorkspaceMutation(createBranchProcedure, (input) =>
    gitWorkspaceMutations.createBranch.affectedQueries(input),
  )
}

export function useGitAddWorktree(): GitMutationAction<Worktree> {
  return useGitWorkspaceMutation(addWorktreeProcedure, (input) =>
    gitWorkspaceMutations.addWorktree.affectedQueries(input),
  )
}
