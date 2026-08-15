import { type Task, taskFixture } from '@porcelain/contracts/tasks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RemoteEnvironment, RemoteEnvironmentState } from './remote-daemon'

/**
 * The Tasks fan-out is the one place in the product that talks to several daemons at once,
 * so the risk it owns is attribution: rows landing under the wrong Environment, an asleep
 * machine reported with stale rows, or a mutation reaching a daemon nobody named. Every
 * daemon here is a plain `fetch` stub keyed by origin, which is what lets a test say "these
 * rows came from THAT url with THAT token".
 */
vi.mock('electron', () => ({
  app: { getPath: (): string => '/tmp/porcelain-shell-tasks-test' },
}))

let localPair: { url: string; token: string } = {
  url: 'http://127.0.0.1:43118',
  token: 'pc_admin_local',
}

vi.mock('./daemon', () => ({
  localDaemonPair: (): { url: string; token: string } => localPair,
}))

let state: RemoteEnvironmentState = { activeId: null, environments: [] }

vi.mock('./remote-daemon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./remote-daemon')>()
  return {
    ...actual,
    loadRemoteEnvironmentState: async (): Promise<RemoteEnvironmentState> => state,
  }
})

const { environmentTaskMutationInput, environmentTasks, mutateEnvironmentTask } = await import(
  './shell-tasks'
)

const LOCAL_URL = 'http://127.0.0.1:43118'
const ALPHA_URL = 'http://alpha.local:43117'
const BETA_LAN_URL = 'http://beta.local:43117'
const BETA_NET_URL = 'http://beta.tail1234.ts.net'

const localTask = taskFixture({
  id: '00000000-0000-4000-8000-0000000000a1',
  title: 'Task on this device',
})
const alphaTask = taskFixture({
  id: '00000000-0000-4000-8000-0000000000b1',
  title: 'Task on Alpha',
  status: 'doing',
})
const betaTask = taskFixture({
  id: '00000000-0000-4000-8000-0000000000c1',
  title: 'Task on Beta',
  status: 'blocked',
})
const createdTask = taskFixture({
  id: '00000000-0000-4000-8000-0000000000c2',
  title: 'Filed on Beta',
})

const alpha: RemoteEnvironment = {
  id: 'env-a',
  name: 'Alpha',
  url: ALPHA_URL,
  token: 'pc_client_alpha',
  endpoints: [ALPHA_URL],
  preferredEndpoint: ALPHA_URL,
  host: 'alpha-host',
}

const beta: RemoteEnvironment = {
  id: 'env-b',
  name: 'Beta',
  url: BETA_LAN_URL,
  token: 'pc_client_beta',
  endpoints: [BETA_LAN_URL, BETA_NET_URL],
  preferredEndpoint: BETA_LAN_URL,
  host: 'beta-host',
}

interface SeenRequest {
  url: string
  method: string
  body: string | null
  headers: Headers
}

/** How one daemon origin behaves for this test. */
type Responder = (procedure: string, method: string) => Response

const seen: SeenRequest[] = []
const responders = new Map<string, Responder>()

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(status === 200 ? { result: { data } } : data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

/** A daemon that serves the given rows and echoes a Task back from any mutation. */
function daemonServing(tasks: Task[], mutationResult: Task = createdTask): Responder {
  return (procedure) => {
    if (procedure === 'listTasks') return jsonResponse(tasks)
    if (procedure === 'deleteTask') return jsonResponse({ taskId: mutationResult.id })
    return jsonResponse(mutationResult)
  }
}

/** A daemon that is asleep: the socket never opens. */
const unreachable: Responder = () => {
  throw new TypeError('fetch failed')
}

/** A daemon that no longer accepts this Environment's token. */
const unauthorized: Responder = () =>
  jsonResponse({ error: { message: 'unauthorized', code: -32001, data: { httpStatus: 401 } } }, 401)

/** A daemon serving rows `listTasksOutputSchema` rejects. */
const malformed: Responder = (procedure) =>
  procedure === 'listTasks' ? jsonResponse([{ id: 'not-a-uuid' }]) : jsonResponse(createdTask)

function stubDaemons(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      seen.push({
        url,
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
        headers: new Headers(init?.headers),
      })
      const origin = [...responders.keys()].find((candidate) =>
        url.startsWith(`${candidate}/trpc/`),
      )
      if (origin === undefined) throw new TypeError(`no daemon stubbed at ${url}`)
      const procedure = url.slice(`${origin}/trpc/`.length).split('?')[0] ?? ''
      const responder = responders.get(origin)
      if (responder === undefined) throw new TypeError(`no daemon stubbed at ${url}`)
      return responder(procedure, init?.method ?? 'GET')
    }),
  )
}

const mutations = (): SeenRequest[] => seen.filter((entry) => entry.method === 'POST')

const authOf = (entry: SeenRequest): string | null => entry.headers.get('authorization')

beforeEach(() => {
  seen.length = 0
  responders.clear()
  localPair = { url: LOCAL_URL, token: 'pc_admin_local' }
  state = { activeId: null, environments: [] }
  stubDaemons()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('environmentTasks aggregation', () => {
  it('labels each answering daemon with its own Environment and rows', async () => {
    state = { activeId: null, environments: [alpha, beta] }
    responders.set(LOCAL_URL, daemonServing([localTask]))
    responders.set(ALPHA_URL, daemonServing([alphaTask]))
    responders.set(BETA_LAN_URL, daemonServing([betaTask]))

    const result = await environmentTasks()

    expect(result).toEqual([
      { id: null, name: 'This device', tasks: [localTask] },
      { id: 'env-a', name: 'Alpha', tasks: [alphaTask] },
      { id: 'env-b', name: 'Beta', tasks: [betaTask] },
    ])
    // The shell's own daemon carries the only null id and a label no Environment can claim.
    const localEntry = result.find((entry) => entry.id === null)
    expect(localEntry?.name).toBe('This device')
    expect([alpha.name, beta.name]).not.toContain(localEntry?.name)
    // No row is attributed twice or to the wrong table.
    const attributions = result.flatMap((entry) => entry.tasks.map((task) => [entry.id, task.id]))
    expect(attributions).toEqual([
      [null, localTask.id],
      ['env-a', alphaTask.id],
      ['env-b', betaTask.id],
    ])
  })

  it('omits an Environment whose every endpoint fails, keeping the online ones', async () => {
    state = { activeId: null, environments: [alpha, beta] }
    responders.set(LOCAL_URL, daemonServing([localTask]))
    responders.set(ALPHA_URL, unreachable)
    responders.set(BETA_LAN_URL, unreachable)
    responders.set(BETA_NET_URL, unreachable)

    const result = await environmentTasks()

    expect(result.map((entry) => entry.id)).toEqual([null])
    expect(result.find((entry) => entry.id === 'env-a')).toBeUndefined()
    expect(result.find((entry) => entry.id === 'env-b')).toBeUndefined()
    expect(result[0]?.tasks).toEqual([localTask])
  })

  it('omits an Environment that rejects the saved token', async () => {
    state = { activeId: null, environments: [alpha, beta] }
    responders.set(LOCAL_URL, daemonServing([localTask]))
    responders.set(ALPHA_URL, unauthorized)
    responders.set(BETA_LAN_URL, daemonServing([betaTask]))

    const result = await environmentTasks()

    expect(result.map((entry) => entry.id)).toEqual([null, 'env-b'])
    expect(result.map((entry) => entry.tasks)).toEqual([[localTask], [betaTask]])
  })

  it('falls through to the second ordered endpoint when the preferred one is down', async () => {
    state = { activeId: null, environments: [beta] }
    responders.set(LOCAL_URL, daemonServing([localTask]))
    responders.set(BETA_LAN_URL, unreachable)
    responders.set(BETA_NET_URL, daemonServing([betaTask]))

    const result = await environmentTasks()

    expect(result).toEqual([
      { id: null, name: 'This device', tasks: [localTask] },
      { id: 'env-b', name: 'Beta', tasks: [betaTask] },
    ])
    // The rows came from the fallback endpoint, and the preferred one was tried first.
    const listed = seen.filter((entry) => entry.url.includes('/trpc/listTasks')).map((e) => e.url)
    expect(listed).toContain(`${BETA_NET_URL}/trpc/listTasks`)
    expect(listed.indexOf(`${BETA_LAN_URL}/trpc/listTasks`)).toBeLessThan(
      listed.indexOf(`${BETA_NET_URL}/trpc/listTasks`),
    )
  })

  it('omits This device when the local daemon is not running', async () => {
    localPair = { url: '', token: 'pc_admin_local' }
    state = { activeId: null, environments: [alpha] }
    responders.set(ALPHA_URL, daemonServing([alphaTask]))

    const result = await environmentTasks()

    expect(result).toEqual([{ id: 'env-a', name: 'Alpha', tasks: [alphaTask] }])
    // Nothing was even attempted against an empty url.
    expect(seen.some((entry) => entry.url.startsWith('/trpc'))).toBe(false)
  })

  it('omits an Environment whose rows do not match the Task contract', async () => {
    state = { activeId: null, environments: [alpha, beta] }
    responders.set(LOCAL_URL, daemonServing([localTask]))
    responders.set(ALPHA_URL, malformed)
    responders.set(BETA_LAN_URL, daemonServing([betaTask]))

    const result = await environmentTasks()

    expect(result.map((entry) => entry.id)).toEqual([null, 'env-b'])
    expect(result.flatMap((entry) => entry.tasks.map((task) => task.id))).toEqual([
      localTask.id,
      betaTask.id,
    ])
  })
})

describe('mutateEnvironmentTask routing', () => {
  beforeEach(() => {
    state = { activeId: null, environments: [alpha, beta] }
    responders.set(LOCAL_URL, daemonServing([localTask]))
    responders.set(ALPHA_URL, daemonServing([alphaTask]))
    responders.set(BETA_LAN_URL, daemonServing([betaTask]))
  })

  it('sends a create only to the named Environment daemon', async () => {
    const input = { title: 'Filed on Beta', status: 'todo' as const }

    const result = await mutateEnvironmentTask({ kind: 'create', environmentId: 'env-b', input })

    expect(result).toEqual({ environmentId: 'env-b', task: createdTask })
    expect(mutations()).toHaveLength(1)
    const sent = mutations()[0]
    expect(sent?.url).toBe(`${BETA_LAN_URL}/trpc/createTask`)
    expect(authOf(sent ?? never())).toBe('Bearer pc_client_beta')
    expect(sent?.body).toBe(JSON.stringify(input))
    // Alpha and This device were read for the table, never written to.
    expect(mutations().some((entry) => entry.url.startsWith(ALPHA_URL))).toBe(false)
    expect(mutations().some((entry) => entry.url.startsWith(LOCAL_URL))).toBe(false)
  })

  it('sends an update only to the named Environment daemon', async () => {
    const input = { taskId: alphaTask.id, status: 'done' as const }

    const result = await mutateEnvironmentTask({ kind: 'update', environmentId: 'env-a', input })

    expect(result).toEqual({ environmentId: 'env-a', task: createdTask })
    expect(mutations().map((entry) => entry.url)).toEqual([`${ALPHA_URL}/trpc/updateTask`])
    expect(authOf(mutations()[0] ?? never())).toBe('Bearer pc_client_alpha')
    expect(mutations()[0]?.body).toBe(JSON.stringify(input))
  })

  it('resolves a delete with no Task and writes only to the named daemon', async () => {
    const input = { taskId: betaTask.id }

    const result = await mutateEnvironmentTask({ kind: 'delete', environmentId: 'env-b', input })

    expect(result).toEqual({ environmentId: 'env-b', task: null })
    expect(mutations().map((entry) => entry.url)).toEqual([`${BETA_LAN_URL}/trpc/deleteTask`])
    expect(authOf(mutations()[0] ?? never())).toBe('Bearer pc_client_beta')
  })

  it('routes a null Environment to the local daemon with the admin token', async () => {
    const input = { title: 'Filed here', status: 'todo' as const }

    const result = await mutateEnvironmentTask({ kind: 'create', environmentId: null, input })

    expect(result).toEqual({ environmentId: null, task: createdTask })
    expect(mutations().map((entry) => entry.url)).toEqual([`${LOCAL_URL}/trpc/createTask`])
    expect(authOf(mutations()[0] ?? never())).toBe('Bearer pc_admin_local')
  })
})

describe('mutateEnvironmentTask refuses unresolvable targets', () => {
  it('rejects an Environment id nobody knows, without writing anywhere', async () => {
    state = { activeId: null, environments: [alpha, beta] }
    responders.set(LOCAL_URL, daemonServing([localTask]))
    responders.set(ALPHA_URL, daemonServing([alphaTask]))
    responders.set(BETA_LAN_URL, daemonServing([betaTask]))

    await expect(
      mutateEnvironmentTask({
        kind: 'create',
        environmentId: 'env-ghost',
        input: { title: 'Nowhere' },
      }),
    ).rejects.toThrow('That environment is no longer connected')
    expect(mutations()).toEqual([])
  })

  it('rejects by name when the named Environment answers on no endpoint', async () => {
    state = { activeId: null, environments: [alpha, beta] }
    responders.set(LOCAL_URL, daemonServing([localTask]))
    responders.set(ALPHA_URL, daemonServing([alphaTask]))
    responders.set(BETA_LAN_URL, unreachable)
    responders.set(BETA_NET_URL, unreachable)

    await expect(
      mutateEnvironmentTask({
        kind: 'update',
        environmentId: 'env-b',
        input: { taskId: betaTask.id, status: 'done' },
      }),
    ).rejects.toThrow('Beta is not reachable right now')
    expect(mutations()).toEqual([])
  })

  it('rejects a local mutation when the local daemon is not running', async () => {
    localPair = { url: '', token: 'pc_admin_local' }
    state = { activeId: null, environments: [alpha] }
    responders.set(ALPHA_URL, daemonServing([alphaTask]))

    await expect(
      mutateEnvironmentTask({
        kind: 'delete',
        environmentId: null,
        input: { taskId: localTask.id },
      }),
    ).rejects.toThrow('The local daemon is not running')
    expect(mutations()).toEqual([])
  })
})

describe('environmentTaskMutationInput', () => {
  it('refuses a payload that names no Environment', () => {
    const parsed = environmentTaskMutationInput.safeParse({
      kind: 'create',
      input: { title: 'Implicit target' },
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.some((issue) => issue.path.includes('environmentId'))).toBe(true)
  })

  it('refuses an unknown kind', () => {
    const parsed = environmentTaskMutationInput.safeParse({
      kind: 'archive',
      environmentId: 'env-a',
      input: { title: 'Unsupported' },
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.some((issue) => issue.path.includes('kind'))).toBe(true)
  })

  it('accepts each supported kind with an explicit target', () => {
    const create = environmentTaskMutationInput.safeParse({
      kind: 'create',
      environmentId: 'env-b',
      input: { title: 'Explicit' },
    })
    const remove = environmentTaskMutationInput.safeParse({
      kind: 'delete',
      environmentId: null,
      input: { taskId: localTask.id },
    })

    expect(create.success).toBe(true)
    expect(remove.data).toEqual({
      kind: 'delete',
      environmentId: null,
      input: { taskId: localTask.id },
    })
  })
})

/** Narrowing helper for the `possibly-undefined` index reads above; never reached green. */
function never(): SeenRequest {
  throw new Error('expected a recorded request')
}
