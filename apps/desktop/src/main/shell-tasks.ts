import {
  createTaskInputSchema,
  deleteTaskInputSchema,
  listTasksOutputSchema,
  type Task,
  taskSchema,
  updateTaskInputSchema,
} from '@porcelain/contracts/tasks'
import { createTRPCUntypedClient, httpLink } from '@trpc/client'
import { z } from 'zod'
import { localDaemonPair } from './daemon'
import { daemonHeaders } from './daemon-headers'
import {
  loadRemoteEnvironmentState,
  orderedEndpoints,
  type RemoteEnvironment,
} from './remote-daemon'

/**
 * Cross-Environment Tasks for the Hub (issue #23, stories 39–40).
 *
 * The Tasks table is daemon-wide, and each Environment daemon stays authoritative for its
 * own. The shell is the only place that can read several at once, so it fans `listTasks` out
 * over This device plus every saved Environment and labels each table with the Environment it
 * came from. An Environment that does not answer — asleep, unreachable, or rejecting the
 * token — is OMITTED rather than reported with stale rows: a Task you cannot write to is
 * worse than a Task you cannot see (issue #18, story 5).
 *
 * Mutations never fan out. Every one names the Environment it targets and reaches exactly
 * that daemon; there is no "current" Environment to fall back on, because a global table with
 * an implicit target is how you file a Task on the wrong machine.
 */

const PROBE_TIMEOUT_MS = 4000

export type EnvironmentTasks = {
  /** `null` is This device — the daemon the shell itself launched. */
  id: string | null
  name: string
  tasks: Task[]
}

function clientFor(url: string, token: string) {
  return createTRPCUntypedClient({
    links: [httpLink({ url: `${url}/trpc`, headers: daemonHeaders(token) })],
  })
}

async function listFrom(url: string, token: string): Promise<Task[] | null> {
  if (url === '') return null
  try {
    const result = await Promise.race([
      clientFor(url, token).query('listTasks'),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS)
      }),
    ])
    return listTasksOutputSchema.parse(result)
  } catch {
    // Offline, unauthorized, or a daemon too old to serve Tasks — all three mean the same
    // thing to the Hub: this Environment contributes no rows right now.
    return null
  }
}

/** Try a saved Environment's addresses in preference order; the first that answers wins. */
async function listFromEnvironment(environment: RemoteEnvironment): Promise<Task[] | null> {
  for (const url of orderedEndpoints(environment)) {
    const tasks = await listFrom(url, environment.token)
    if (tasks !== null) return tasks
  }
  return null
}

/** Tasks from every Environment that answered, This device first. Offline ones are absent. */
export async function environmentTasks(): Promise<EnvironmentTasks[]> {
  const state = await loadRemoteEnvironmentState()
  const local = localDaemonPair()
  const [localTasks, ...remoteTasks] = await Promise.all([
    listFrom(local.url, local.token),
    ...state.environments.map(listFromEnvironment),
  ])

  const results: EnvironmentTasks[] = []
  if (localTasks !== null) results.push({ id: null, name: 'This device', tasks: localTasks })
  state.environments.forEach((environment, index) => {
    const tasks = remoteTasks[index]
    if (tasks === undefined || tasks === null) return
    results.push({ id: environment.id, name: environment.name, tasks })
  })
  return results
}

/**
 * One Task mutation aimed at one Environment. The discriminated input is what makes the
 * target explicit at the type level: there is no shape here that omits `environmentId`.
 */
export const environmentTaskMutationInput = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('create'),
      environmentId: z.string().min(1).nullable(),
      input: createTaskInputSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('update'),
      environmentId: z.string().min(1).nullable(),
      input: updateTaskInputSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('delete'),
      environmentId: z.string().min(1).nullable(),
      input: deleteTaskInputSchema,
    })
    .strict(),
])
export type EnvironmentTaskMutation = z.infer<typeof environmentTaskMutationInput>

const PROCEDURE_BY_KIND = {
  create: 'createTask',
  update: 'updateTask',
  delete: 'deleteTask',
} as const

/** Resolve the daemon pair for an Environment id, or fail loudly rather than guessing. */
async function daemonFor(environmentId: string | null): Promise<{ url: string; token: string }> {
  if (environmentId === null) {
    const local = localDaemonPair()
    if (local.url === '') throw new Error('The local daemon is not running')
    return local
  }
  const state = await loadRemoteEnvironmentState()
  const environment = state.environments.find((candidate) => candidate.id === environmentId)
  if (environment === undefined) {
    throw new Error('That environment is no longer connected')
  }
  for (const url of orderedEndpoints(environment)) {
    if ((await listFrom(url, environment.token)) !== null) {
      return { url, token: environment.token }
    }
  }
  throw new Error(`${environment.name} is not reachable right now`)
}

/** Route one Task mutation to the named Environment daemon. Never to any other. */
export async function mutateEnvironmentTask(
  mutation: EnvironmentTaskMutation,
): Promise<{ environmentId: string | null; task: Task | null }> {
  const daemon = await daemonFor(mutation.environmentId)
  const result = await clientFor(daemon.url, daemon.token).mutation(
    PROCEDURE_BY_KIND[mutation.kind],
    mutation.input,
  )
  if (mutation.kind === 'delete') return { environmentId: mutation.environmentId, task: null }
  return { environmentId: mutation.environmentId, task: taskSchema.parse(result) }
}
