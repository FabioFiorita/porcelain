import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionChangeObserver } from '@/lib/daemon/session'

const ctx = vi.hoisted(() => ({
  environment: null as { id: string; token: string | null } | null,
  observers: [] as SessionChangeObserver[],
  repoPath: '/synthetic/repo' as string | null,
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/lib/daemon/repo', () => ({
  useActiveRepo: () => (ctx.repoPath === null ? null : { name: 'repo', path: ctx.repoPath }),
}))
vi.mock('@/lib/daemon/session', () => ({
  subscribeSessionChanges: (observer: SessionChangeObserver): (() => void) => {
    ctx.observers.push(observer)
    return () => {
      ctx.observers = ctx.observers.filter((entry) => entry !== observer)
    }
  },
}))

import { filesPinsQuery } from '@porcelain/client-runtime/files'
import { FilesNotificationBridge } from './files-notification-bridge'
import { filesQueryKey } from './files-query-key'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.environment = { id: 'env-files-bridge', token: 'paired' }
  ctx.observers = []
  ctx.repoPath = '/synthetic/repo'
})

describe('FilesNotificationBridge', () => {
  it('subscribes only while paired and unsubscribes on unmount', async () => {
    const queryClient = new QueryClient()
    ctx.environment = { id: 'env-files-bridge', token: null }
    const view = render(<FilesNotificationBridge />, { wrapper: wrapper(queryClient) })
    expect(ctx.observers).toHaveLength(0)
    view.unmount()

    ctx.environment = { id: 'env-files-bridge', token: 'paired' }
    const paired = render(<FilesNotificationBridge />, { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(ctx.observers).toHaveLength(1))
    paired.unmount()
    expect(ctx.observers).toHaveLength(0)
  })

  it('routes a typed Files change through the active environment key', async () => {
    const queryClient = new QueryClient()
    const key = filesQueryKey('env-files-bridge', filesPinsQuery('/synthetic/repo'))
    queryClient.setQueryData(key, [])
    const view = render(<FilesNotificationBridge />, { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(ctx.observers).toHaveLength(1))
    const observer = ctx.observers[0]
    if (observer === undefined) throw new Error('expected Files subscription')

    act(() => {
      observer.onChange({ kind: 'files.scope-changed', projectPath: '/synthetic/repo' })
    })
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    view.unmount()
  })
})
