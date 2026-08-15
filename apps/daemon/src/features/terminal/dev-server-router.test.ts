// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import { createDevServerRouter } from './dev-server-router'

const devServers = {
  list: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  dismiss: vi.fn(),
}

const router = createDevServerRouter(devServers)

const REQUEST_ID = '00000000-0000-4000-8000-000000000021'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const

const TARGET = {
  projectId: 'project-1',
  worktreeId: 'worktree-1',
  path: '/synthetic/repo',
} as const

const SERVER = {
  id: 'dev-server-1',
  target: TARGET,
  label: 'web',
  command: 'pnpm dev',
  cwd: '/synthetic/repo',
  status: 'running',
  terminalId: 'terminal-1',
  createdAt: 1,
  startedAt: 2,
} as const

function caller() {
  return router.createCaller(PUBLIC_CONTEXT)
}

async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router,
    path,
    type,
    ctx: PUBLIC_CONTEXT,
    getRawInput: async () => input,
    signal: undefined,
    batchIndex: 0,
  })
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

function expectPublicCode(error: unknown, code: string, unexpected: boolean) {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(unexpected)
  expect(publicErrorSchema.parse(normalized.error)).toMatchObject({ code, requestId: REQUEST_ID })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('development server router input', () => {
  it('rejects a start with a partial target without spawning anything', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('startDevServer', 'mutation', {
          target: { projectId: 'project-1', path: '/synthetic/repo' },
          label: 'web',
          command: 'pnpm dev',
        }),
      ),
      'request.invalid',
      false,
    )
    expect(devServers.start).not.toHaveBeenCalled()
  })

  it('rejects a start with no target at all — there is no ambient checkout to fall back on', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('startDevServer', 'mutation', { label: 'web', command: 'pnpm dev' }),
      ),
      'request.invalid',
      false,
    )
    expect(devServers.start).not.toHaveBeenCalled()
  })

  it('rejects an empty command rather than running a bare shell as a server', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('startDevServer', 'mutation', {
          target: TARGET,
          label: 'web',
          command: '',
        }),
      ),
      'request.invalid',
      false,
    )
    expect(devServers.start).not.toHaveBeenCalled()
  })

  it('passes an explicit roster filter through to the operation', async () => {
    devServers.list.mockReturnValue([SERVER])

    expect(await caller().devServers({ target: TARGET })).toEqual([SERVER])
    expect(devServers.list).toHaveBeenCalledWith({ target: TARGET })
  })

  it('allows an unfiltered roster read for the whole daemon', async () => {
    devServers.list.mockReturnValue([])

    expect(await caller().devServers({})).toEqual([])
    expect(devServers.list).toHaveBeenCalledWith({})
  })
})

describe('development server router failures', () => {
  it('maps a rejected target to its public invalid-request code', async () => {
    devServers.start.mockReturnValue({ ok: false, error: { code: 'terminal.dev-server-target' } })

    expectPublicCode(
      await rejected(() => caller().startDevServer({ target: TARGET, label: 'w', command: 'c' })),
      'terminal.dev-server-target',
      false,
    )
  })

  it('maps an unknown server on stop to its public not-found code', async () => {
    devServers.stop.mockReturnValue({
      ok: false,
      error: { code: 'terminal.dev-server-not-found' },
    })

    expectPublicCode(
      await rejected(() => caller().stopDevServer({ id: 'dev-server-404' })),
      'terminal.dev-server-not-found',
      false,
    )
  })

  it('maps dismissing a live server to its public conflict code', async () => {
    devServers.dismiss.mockReturnValue({
      ok: false,
      error: { code: 'terminal.dev-server-running' },
    })

    expectPublicCode(
      await rejected(() => caller().dismissDevServer({ id: SERVER.id })),
      'terminal.dev-server-running',
      false,
    )
  })
})

describe('development server router output', () => {
  it('serializes a started server and binds it to the underlying session', async () => {
    devServers.start.mockReturnValue({ ok: true, value: SERVER })

    expect(
      await caller().startDevServer({ target: TARGET, label: 'web', command: 'pnpm dev' }),
    ).toEqual(SERVER)
  })

  it('serializes a stop as the finished record, and a dismiss as nothing', async () => {
    const stopped = { ...SERVER, status: 'stopped', endedAt: 9 } as const
    devServers.stop.mockReturnValue({ ok: true, value: stopped })
    devServers.dismiss.mockReturnValue({ ok: true, value: undefined })

    expect(await caller().stopDevServer({ id: SERVER.id })).toEqual(stopped)
    expect(await caller().dismissDevServer({ id: SERVER.id })).toBeUndefined()
  })

  it('refuses to serialize a record whose status violates the contract', async () => {
    devServers.list.mockReturnValue([{ ...SERVER, status: 'paused' }])

    expectPublicCode(await rejected(() => caller().devServers({})), 'internal.unexpected', true)
  })
})
