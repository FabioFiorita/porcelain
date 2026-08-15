import {
  resolveTasksTarget,
  tasksMutations,
  tasksTableQuery,
} from '@porcelain/client-runtime/tasks'
import type {
  CreateTaskInput,
  DeleteTaskInput,
  Task,
  UpdateTaskInput,
} from '@porcelain/contracts/tasks'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc, trpc } from '@renderer/lib/trpc'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksTableQueryKey } from './tasks-query-key'

/**
 * Writing to the Tasks table — always to ONE named Environment.
 *
 * The global view is the whole danger here: a table that shows three machines' rows and
 * writes to "the current one" will eventually file a Task on the wrong machine. So every
 * call takes the Environment explicitly, and an unresolvable target is a typed refusal the
 * caller must render — never a silent no-op and never a guess.
 *
 * `null` is a legitimate target (the directly-connected daemon); `undefined` means the
 * client could not work out an owner, which is the case that gets rejected.
 */

export class MissingEnvironmentTargetError extends Error {
  readonly code = 'tasks.no-environment-target'
  constructor() {
    super('Choose the Environment this Task belongs to before saving it.')
    this.name = 'MissingEnvironmentTargetError'
  }
}

export type TaskEnvironmentTarget = string | null | undefined

type CreateVariables = { environmentId: string | null; input: CreateTaskInput }
type UpdateVariables = { environmentId: string | null; input: UpdateTaskInput }
type DeleteVariables = { environmentId: string | null; input: DeleteTaskInput }

function requireTarget(environmentId: TaskEnvironmentTarget): string | null {
  const resolved = resolveTasksTarget(environmentId)
  if (!resolved.ok) throw new MissingEnvironmentTargetError()
  return resolved.value.environmentId
}

/**
 * The browser client is served BY its Environment and can only speak to that one. A row
 * belonging to another Environment must not be writable from here — refusing is honest;
 * routing it to the local daemon would silently move the Task.
 */
function assertReachable(environmentId: string | null): void {
  if (isBrowser && environmentId !== null) {
    throw new MissingEnvironmentTargetError()
  }
}

export function useTaskActions(): {
  add: (environmentId: TaskEnvironmentTarget, input: CreateTaskInput) => Promise<Task>
  update: (environmentId: TaskEnvironmentTarget, input: UpdateTaskInput) => Promise<void>
  remove: (environmentId: TaskEnvironmentTarget, taskId: string) => Promise<void>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const daemonScope: DaemonScope = { host: daemon.host, version: daemon.version }
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
  const shellClient = shellTrpc.useUtils().client

  const invalidate = async (environmentId: string | null): Promise<void> => {
    for (const identity of tasksMutations.create.affectedQueries({ environmentId })) {
      await queryClient.invalidateQueries({
        queryKey: tasksTableQueryKey(daemonScope, identity),
        exact: true,
      })
    }
    if (!isBrowser) {
      // The shell's fan-out query is one cache entry covering every Environment, so a
      // write to any of them makes it stale — the per-Environment identity above is what
      // the browser client reads.
      await queryClient.invalidateQueries({ queryKey: [['environmentTasks']] })
    }
  }

  const create = useMutation({
    mutationFn: async (variables: CreateVariables): Promise<Task> => {
      if (isBrowser) return client.createTask.mutate(variables.input)
      const result = await shellClient.environmentTaskMutation.mutate({
        kind: 'create',
        environmentId: variables.environmentId,
        input: variables.input,
      })
      if (result.task === null) throw new Error('The daemon did not return the new Task')
      return result.task
    },
    onSettled: async (_data, _error, variables): Promise<void> => {
      await invalidate(variables.environmentId)
    },
  })

  const update = useMutation({
    mutationFn: async (variables: UpdateVariables): Promise<void> => {
      if (isBrowser) {
        await client.updateTask.mutate(variables.input)
        return
      }
      await shellClient.environmentTaskMutation.mutate({
        kind: 'update',
        environmentId: variables.environmentId,
        input: variables.input,
      })
    },
    onSettled: async (_data, _error, variables): Promise<void> => {
      await invalidate(variables.environmentId)
    },
  })

  const remove = useMutation({
    mutationFn: async (variables: DeleteVariables): Promise<void> => {
      if (isBrowser) {
        await client.deleteTask.mutate(variables.input)
        return
      }
      await shellClient.environmentTaskMutation.mutate({
        kind: 'delete',
        environmentId: variables.environmentId,
        input: variables.input,
      })
    },
    onSettled: async (_data, _error, variables): Promise<void> => {
      await invalidate(variables.environmentId)
    },
  })

  return {
    add: async (environmentId, input) => {
      const target = requireTarget(environmentId)
      assertReachable(target)
      return create.mutateAsync({ environmentId: target, input })
    },
    update: async (environmentId, input) => {
      const target = requireTarget(environmentId)
      assertReachable(target)
      await update.mutateAsync({ environmentId: target, input })
    },
    remove: async (environmentId, taskId) => {
      const target = requireTarget(environmentId)
      assertReachable(target)
      await remove.mutateAsync({ environmentId: target, input: { taskId } })
    },
    isPending: create.isPending || update.isPending || remove.isPending,
  }
}

/** The table identity a caller should invalidate after an out-of-band change. */
export function taskTableIdentity(environmentId: string | null) {
  return tasksTableQuery(environmentId)
}
