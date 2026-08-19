import type { ActionView, PrepareActionRunOutput } from '@porcelain/contracts/actions'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  daemonDispatch,
  ENV_ID,
  hubInventoryKey,
  PROJECT_ID,
  SECOND_REPO_PATH,
  SECOND_WORKTREE_ID,
  UNKNOWN_PATH,
} from './test-support'

const spawnTerminalSession = vi.fn(async (_input?: unknown) => 'term-1')

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env-actions-test', token: 'paired' } as {
    id: string
    token: string | null
  } | null,
  project: { name: 'alpha-review', path: '/synthetic/projects/alpha-review' } as {
    name: string
    path: string
  } | null,
}))

vi.mock('@/features/remote', () => ({
  // Pure identity the subject reads from the same feature index; the store half is faked below.
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/features/projects', () => ({
  useActiveProject: () => ctx.project,
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ query: vi.fn(), mutation: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})
vi.mock('@/features/terminal', () => ({
  spawnTerminalSession: (input: unknown) => spawnTerminalSession(input),
}))

import { useActionRun } from './action-run'

const trustedPrimary: ActionView = {
  id: 'a1',
  title: 'Build',
  command: 'make build',
  kind: 'action',
  order: 1,
  createdAt: 1,
  trusted: true,
}

/**
 * What the daemon authorizes — deliberately different title, command text, and cwd from
 * anything the client already holds, so a client that re-derives any of them from the
 * ActionView or from the local path fails these tests.
 */
const authorizedPrimary: PrepareActionRunOutput = {
  id: 'a1',
  title: 'Build (authorized)',
  command: 'make build --authorized',
  where: 'primary',
  cwd: '/synthetic/daemon-verified/alpha-review',
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function callsTo(name: string): unknown[][] {
  return ctx.callDaemon.mock.calls.filter(
    (call: unknown[]) => (call[1] as { name: string }).name === name,
  )
}

/** Render the hook and wait until the Hub inventory read that resolves the target lands. */
async function runner(): Promise<(action: ActionView) => Promise<void>> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { result } = renderHook(() => useActionRun(), { wrapper: wrapper(queryClient) })
  await waitFor(() => expect(queryClient.getQueryData(hubInventoryKey(ENV_ID))).toBeDefined())
  expect(callsTo('hubInventory')).toHaveLength(1)
  return (action: ActionView) => result.current(action)
}

beforeEach(() => {
  spawnTerminalSession.mockReset()
  spawnTerminalSession.mockResolvedValue('term-1')
  ctx.environment = { id: ENV_ID, token: 'paired' }
  ctx.project = { name: 'alpha-review', path: SECOND_REPO_PATH }
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockImplementation(daemonDispatch({ prepareActionRun: () => authorizedPrimary }))
})

describe('mobile useActionRun', () => {
  it('authorizes against the checkout the human has open, not the Project primary', async () => {
    const run = await runner()
    await run(trustedPrimary)

    expect(callsTo('prepareActionRun')).toHaveLength(1)
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'prepareActionRun' }),
      {
        actionId: 'a1',
        target: {
          environmentId: ENV_ID,
          projectId: PROJECT_ID,
          worktreeId: SECOND_WORKTREE_ID,
          path: SECOND_REPO_PATH,
        },
      },
    )
  })

  it('spawns one terminal with the daemon-returned command and verified cwd', async () => {
    const run = await runner()
    await run(trustedPrimary)

    expect(spawnTerminalSession).toHaveBeenCalledTimes(1)
    expect(spawnTerminalSession).toHaveBeenCalledWith({
      cwd: authorizedPrimary.cwd,
      name: authorizedPrimary.title,
      initialInput: authorizedPrimary.command,
    })
  })

  it('refuses to run when the open checkout is no Worktree the daemon knows', async () => {
    ctx.project = { name: 'stray', path: UNKNOWN_PATH }
    const run = await runner()

    await expect(run(trustedPrimary)).rejects.toThrow(/No Worktree target/)
    expect(callsTo('prepareActionRun')).toEqual([])
    expect(spawnTerminalSession).not.toHaveBeenCalled()
  })

  it('surfaces a daemon refusal without spawning', async () => {
    const run = await runner()
    ctx.callDaemon.mockImplementation(
      daemonDispatch({
        prepareActionRun: () => {
          throw new Error('actions.untrusted')
        },
      }),
    )

    await expect(run(trustedPrimary)).rejects.toThrow('actions.untrusted')
    expect(spawnTerminalSession).not.toHaveBeenCalled()
  })

  it('refuses an action the daemon says runs on the human’s own device', async () => {
    const run = await runner()
    const localRun: PrepareActionRunOutput = { ...authorizedPrimary, where: 'local' }
    ctx.callDaemon.mockImplementation(daemonDispatch({ prepareActionRun: () => localRun }))

    await expect(run(trustedPrimary)).rejects.toThrow(/own device/)
    expect(spawnTerminalSession).not.toHaveBeenCalled()
  })

  it('surfaces spawn failure', async () => {
    spawnTerminalSession.mockRejectedValueOnce(new Error('pty failed'))
    const run = await runner()

    await expect(run(trustedPrimary)).rejects.toThrow('pty failed')
  })
})
