import {
  createHubWorktree,
  type ProjectsQuery,
  removeHubWorktree,
} from '@porcelain/client-runtime/projects'
import {
  type CreateHubWorktreeInput,
  type HubWorktree,
  projectsProcedures,
} from '@porcelain/contracts/projects'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { callProjectDaemon, projectsQueryKey } from '@/features/projects'
import {
  activeProjectPathOf,
  type Environment,
  environmentActions,
  getEnvironment,
} from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

/**
 * Writing Worktrees from the Hub list — always to ONE named Environment.
 *
 * The list is cross-Environment by definition, so the row's daemon is frequently not the
 * active one. Every call therefore takes the Environment record explicitly and invalidates
 * under THAT Environment's cache identity; reading "the current daemon" here would refresh
 * the wrong inventory and create the Worktree on the wrong machine.
 */

const createWorktreeProcedure = namedContractProcedure(
  'createHubWorktree',
  projectsProcedures.createHubWorktree,
)
const removeWorktreeProcedure = namedContractProcedure(
  'removeHubWorktree',
  projectsProcedures.removeHubWorktree,
)

async function invalidate(
  queryClient: ReturnType<typeof useQueryClient>,
  environmentId: string,
  queries: readonly ProjectsQuery[],
): Promise<void> {
  for (const query of queries) {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: projectsQueryKey(environmentId, query),
    })
  }
}

type CreateVariables = { environment: Environment; input: CreateHubWorktreeInput }

/** Create a Worktree on one Environment and refresh that Environment's inventory. */
export function useCreateHubWorktree(): {
  create: (environment: Environment, input: CreateHubWorktreeInput) => Promise<HubWorktree>
  isPending: boolean
} {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (variables: CreateVariables): Promise<HubWorktree> =>
      callProjectDaemon(variables.environment, createWorktreeProcedure, variables.input),
    // Settled, not success: a write that failed in flight may still have landed, and the
    // inventory query is the only authority on what the daemon actually holds.
    onSettled: async (_data, _error, variables): Promise<void> => {
      await invalidate(
        queryClient,
        variables.environment.id,
        createHubWorktree.affectedQueries(variables.input),
      )
    },
  })

  return {
    create: async (environment, input): Promise<HubWorktree> =>
      mutation.mutateAsync({ environment, input }),
    isPending: mutation.isPending,
  }
}

type RetireVariables = { environment: Environment; worktree: HubWorktree }

/**
 * Retire a Worktree: `git worktree remove` on the daemon, so the checkout leaves the disk.
 *
 * The shared binding's `selectionEffect` is `'none'` because its input names a Worktree while
 * the effect compares Projects — the caller owns the cleanup. Mobile's selection is a PATH on
 * the Environment record, so a retire of the open checkout would otherwise leave every surface
 * pointed at a directory that no longer exists.
 */
export function useRetireHubWorktree(): {
  retire: (environment: Environment, worktree: HubWorktree) => Promise<void>
  isPending: boolean
} {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (variables: RetireVariables): Promise<void> => {
      await callProjectDaemon(variables.environment, removeWorktreeProcedure, {
        projectId: variables.worktree.projectId,
        worktreeId: variables.worktree.id,
      })
    },
    onSuccess: async (_result, variables): Promise<void> => {
      const current = getEnvironment(variables.environment.id)
      if (current !== null && activeProjectPathOf(current) === variables.worktree.path) {
        await environmentActions.setActiveProjectPath(current.id, null)
      }
    },
    onSettled: async (_data, _error, variables): Promise<void> => {
      await invalidate(
        queryClient,
        variables.environment.id,
        removeHubWorktree.affectedQueries({
          projectId: variables.worktree.projectId,
          worktreeId: variables.worktree.id,
        }),
      )
    },
  })

  return {
    isPending: mutation.isPending,
    retire: async (environment, worktree): Promise<void> => {
      await mutation.mutateAsync({ environment, worktree })
    },
  }
}
