import { resolveTasksTarget, tasksMutations } from '@porcelain/client-runtime/tasks'
import type { CreateTaskInput, Task, UpdateTaskInput } from '@porcelain/contracts/tasks'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getEnvironment } from '@/features/remote'

import { createTaskProcedure, updateTaskProcedure } from './tasks-procedures'
import { invalidateTasksIdentities } from './tasks-query-key'
import { callTasksProcedure } from './use-tasks-transport'

/**
 * Writing to the Tasks board — always to ONE named Environment.
 *
 * The global board is the whole danger: a screen showing three machines' rows that writes to
 * "the current one" will eventually file a Task on the wrong machine. So every call takes the
 * Environment explicitly and an unresolvable target is a typed refusal the caller renders,
 * never a silent no-op and never a guess.
 *
 * Web's `null` target — the single directly-connected daemon — has no mobile equivalent: a
 * phone reaches every daemon through a pairing record, so a target here is always an id.
 */

export class MissingEnvironmentTargetError extends Error {
  readonly code = 'tasks.no-environment-target'
  constructor() {
    super('Choose the Environment this Task belongs to before saving it.')
    this.name = 'MissingEnvironmentTargetError'
  }
}

/** `undefined` is "nobody has chosen yet" and is refused; a string is a pairing record id. */
export type TaskEnvironmentTarget = string | undefined

function requireTarget(environmentId: TaskEnvironmentTarget): string {
  const resolved = resolveTasksTarget(environmentId)
  if (!resolved.ok || resolved.value.environmentId === null) {
    throw new MissingEnvironmentTargetError()
  }
  return resolved.value.environmentId
}

type CreateVariables = { environmentId: string; input: CreateTaskInput }
type UpdateVariables = { environmentId: string; input: UpdateTaskInput }

export function useTaskActions(): {
  add: (environmentId: TaskEnvironmentTarget, input: CreateTaskInput) => Promise<Task>
  update: (environmentId: TaskEnvironmentTarget, input: UpdateTaskInput) => Promise<void>
  isPending: boolean
} {
  const queryClient = useQueryClient()

  const invalidate = async (
    environmentId: string,
    affected: (typeof tasksMutations)[keyof typeof tasksMutations]['affectedQueries'],
  ): Promise<void> => {
    await invalidateTasksIdentities(queryClient, affected({ environmentId }))
  }

  const create = useMutation({
    mutationFn: async (variables: CreateVariables): Promise<Task> =>
      callTasksProcedure(
        getEnvironment(variables.environmentId),
        createTaskProcedure,
        variables.input,
      ),
    // Settled, not success: a write that failed mid-flight may still have landed, and the
    // list query is the only authority on what the daemon actually holds.
    onSettled: async (_data, _error, variables): Promise<void> => {
      await invalidate(variables.environmentId, tasksMutations.create.affectedQueries)
    },
  })

  const update = useMutation({
    mutationFn: async (variables: UpdateVariables): Promise<Task> =>
      callTasksProcedure(
        getEnvironment(variables.environmentId),
        updateTaskProcedure,
        variables.input,
      ),
    onSettled: async (_data, _error, variables): Promise<void> => {
      await invalidate(variables.environmentId, tasksMutations.update.affectedQueries)
    },
  })

  return {
    add: async (environmentId, input) =>
      create.mutateAsync({ environmentId: requireTarget(environmentId), input }),
    update: async (environmentId, input) => {
      await update.mutateAsync({ environmentId: requireTarget(environmentId), input })
    },
    isPending: create.isPending || update.isPending,
  }
}
