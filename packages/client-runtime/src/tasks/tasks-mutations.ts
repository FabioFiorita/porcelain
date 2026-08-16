import type { CreateTaskInput, DeleteTaskInput, UpdateTaskInput } from '@porcelain/contracts/tasks'
import { tasksProcedures } from '@porcelain/contracts/tasks'
import { type TasksTableQuery, tasksTableQuery } from './tasks-queries'

/**
 * Tasks mutation consequence definitions.
 *
 * Every entry binds exactly one canonical procedure and the table identity it affects.
 * Unlike project-scoped domains, the affected identity is NOT derivable from the input: the input carries no
 * Environment (the daemon that answers is the Environment), so the caller must state which
 * Environment it is writing to. That is the point — a global table must never guess the
 * machine, and `mustTarget` below is how an adapter refuses to.
 */

type TasksProcedure = (typeof tasksProcedures)[keyof typeof tasksProcedures]

export type TasksMutationDefinition<TInput> = {
  readonly procedure: TasksProcedure
  readonly procedureName: keyof typeof tasksProcedures
  readonly affectedQueries: (target: TasksMutationTarget) => readonly TasksTableQuery[]
  readonly requiresAuthoritativeRefetch: true
  /** Present only so each definition names the input it validates at the call site. */
  readonly input?: (input: TInput) => TInput
}

/** The authoritative Environment a mutation is routed to. */
export type TasksMutationTarget = Readonly<{ environmentId: string | null }>

/** Thrown/returned identity for a mutation with no resolvable Environment. */
export type TasksMissingTarget = Readonly<{ code: 'tasks.no-environment-target' }>

/**
 * Resolve the Environment a mutation must go to, or report that there is none.
 *
 * `undefined` means "the client could not work out which daemon owns this write" — an
 * aggregated Hub with nothing selected, or an Environment that went offline between render
 * and click. `null` is different and legitimate: the single directly-connected daemon.
 */
export function resolveTasksTarget(
  environmentId: string | null | undefined,
): { ok: true; value: TasksMutationTarget } | { ok: false; error: TasksMissingTarget } {
  if (environmentId === undefined) {
    return { ok: false, error: { code: 'tasks.no-environment-target' } }
  }
  return { ok: true, value: { environmentId } }
}

const affected = (target: TasksMutationTarget): readonly TasksTableQuery[] => [
  tasksTableQuery(target.environmentId),
]

export const tasksMutations = {
  create: {
    procedure: tasksProcedures.createTask,
    procedureName: 'createTask',
    affectedQueries: affected,
    requiresAuthoritativeRefetch: true,
  },
  update: {
    procedure: tasksProcedures.updateTask,
    procedureName: 'updateTask',
    affectedQueries: affected,
    requiresAuthoritativeRefetch: true,
  },
  delete: {
    procedure: tasksProcedures.deleteTask,
    procedureName: 'deleteTask',
    affectedQueries: affected,
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly create: TasksMutationDefinition<CreateTaskInput>
  readonly update: TasksMutationDefinition<UpdateTaskInput>
  readonly delete: TasksMutationDefinition<DeleteTaskInput>
}

export type TasksMutation = (typeof tasksMutations)[keyof typeof tasksMutations]
