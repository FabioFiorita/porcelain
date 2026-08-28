import type { CanvasRecord } from '@porcelain/contracts/projects'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  daemonDispatch,
  ENV_ID,
  PROJECT_ID,
  REPO_PATH,
  UNKNOWN_PATH,
} from '@/features/actions/test-support'

const BASE_URL = 'http://synthetic-host:43117'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: {
    baseUrl: 'http://synthetic-host:43117',
    enabled: true,
    id: 'env-actions-test',
    token: 'paired',
  } as { baseUrl: string; enabled: boolean; id: string; token: string | null } | null,
  repoPath: '/synthetic/projects/alpha' as string | null,
}))

vi.mock('@/features/remote', () => ({
  activeProjectPathOf: () => ctx.repoPath,
  isEnabled: (environment: { enabled: boolean } | null): boolean =>
    environment !== null && environment.enabled,
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.environment,
  useEnvironments: () => (ctx.environment === null ? [] : [ctx.environment]),
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ mutation: vi.fn(), query: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { useCanvasDocumentUrl, useCanvasList } from './canvas-data'

const RECORD: CanvasRecord = {
  createdAt: '2026-08-19T10:00:00.000Z',
  id: 'canvas-1',
  kind: 'html',
  title: 'What changed',
  tracked: false,
  updatedAt: '2026-08-19T11:00:00.000Z',
  worktreeId: null,
}

function wrapper(): (props: { children: ReactNode }) => React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }): React.JSX.Element {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.callDaemon.mockReset()
  ctx.environment = { baseUrl: BASE_URL, enabled: true, id: ENV_ID, token: 'paired' }
  ctx.repoPath = REPO_PATH
})

describe('useCanvasList', () => {
  it('lists the selected Worktree, so a tracked overlay wins over a private record', async () => {
    ctx.callDaemon.mockImplementation(daemonDispatch({ listCanvases: () => [RECORD] }))
    const { result } = renderHook(() => useCanvasList(true), { wrapper: wrapper() })

    await waitFor(() => {
      expect(result.current.canvases).toEqual([RECORD])
    })
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'listCanvases' }),
      { projectId: PROJECT_ID, worktreeId: 'wt-alpha-main', worktreePath: REPO_PATH },
    )
  })

  it('asks for nothing while the surface is off screen', () => {
    ctx.callDaemon.mockImplementation(daemonDispatch({ listCanvases: () => [RECORD] }))
    renderHook(() => useCanvasList(false), { wrapper: wrapper() })

    expect(ctx.callDaemon).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'listCanvases' }),
      expect.anything(),
    )
  })

  it('asks for nothing when the checkout is not a Worktree this daemon knows', async () => {
    ctx.repoPath = UNKNOWN_PATH
    ctx.callDaemon.mockImplementation(daemonDispatch({ listCanvases: () => [RECORD] }))
    const { result } = renderHook(() => useCanvasList(true), { wrapper: wrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(ctx.callDaemon).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'listCanvases' }),
      expect.anything(),
    )
  })

  it('reports a refusal instead of showing an empty Canvas list', async () => {
    ctx.callDaemon.mockImplementation(
      daemonDispatch({
        listCanvases: () => {
          throw new Error('canvas.unavailable')
        },
      }),
    )
    const { result } = renderHook(() => useCanvasList(true), { wrapper: wrapper() })

    await waitFor(() => {
      expect(result.current.loadError).toBe('canvas.unavailable')
    })
  })
})

describe('useCanvasDocumentUrl', () => {
  it('mints a scoped token and points at the daemon that issued it', async () => {
    ctx.callDaemon.mockImplementation(
      daemonDispatch({ mintCanvasAccessToken: () => ({ token: 'grant-abc' }) }),
    )
    const { result } = renderHook(() => useCanvasDocumentUrl('canvas-1', true), {
      wrapper: wrapper(),
    })

    await waitFor(() => {
      expect(result.current.url).toBe(`${BASE_URL}/canvas/grant-abc`)
    })
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'mintCanvasAccessToken' }),
      { canvasId: 'canvas-1', projectId: PROJECT_ID, worktreePath: REPO_PATH },
    )
  })

  it('never mints for a Markdown Canvas, which the caller disables', () => {
    ctx.callDaemon.mockImplementation(daemonDispatch({}))
    const { result } = renderHook(() => useCanvasDocumentUrl('canvas-1', false), {
      wrapper: wrapper(),
    })

    expect(result.current.url).toBeNull()
    expect(ctx.callDaemon).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'mintCanvasAccessToken' }),
      expect.anything(),
    )
  })

  it('keeps the loading state on a failed mint rather than a WebView pointed nowhere', async () => {
    ctx.callDaemon.mockImplementation(
      daemonDispatch({
        mintCanvasAccessToken: () => {
          throw new Error('canvas.not-found')
        },
      }),
    )
    const { result } = renderHook(() => useCanvasDocumentUrl('canvas-1', true), {
      wrapper: wrapper(),
    })

    await waitFor(() => {
      expect(result.current.mintError).toBe('canvas.not-found')
    })
    expect(result.current.url).toBeNull()
  })
})
