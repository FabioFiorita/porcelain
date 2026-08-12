import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionChangeObserver } from '@/lib/daemon/session'

import { ReviewCommentNotificationBridge } from './comment-notification-bridge'
import { reviewCommentsQueryKey } from './comment-query-key'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'
const ENV_A = 'env-bridge-a'
const ENV_B = 'env-bridge-b'

const ctx = vi.hoisted(() => ({
  envId: null as string | null,
  observers: [] as SessionChangeObserver[],
}))

vi.mock('@/features/remote', () => ({
  // Pure identity the subject reads from the same feature index; the store half is faked below.
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => (ctx.envId === null ? null : { id: ctx.envId, token: 't' }),
}))

vi.mock('@/lib/daemon/session', () => ({
  subscribeSessionChanges: (observer: SessionChangeObserver): (() => void) => {
    ctx.observers.push(observer)
    return () => {
      ctx.observers = ctx.observers.filter((entry) => entry !== observer)
    }
  },
}))

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.envId = ENV_A
  ctx.observers = []
})

describe('ReviewCommentNotificationBridge', () => {
  it('subscribes once, targets only the active env/exact Project, rebinds on switch, and unsubscribes on unmount', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const keyA = reviewCommentsQueryKey(ENV_A, PROJECT)
    const keyAOther = reviewCommentsQueryKey(ENV_A, OTHER)
    const keyB = reviewCommentsQueryKey(ENV_B, PROJECT)

    queryClient.setQueryData(keyA, ['a'])
    queryClient.setQueryData(keyAOther, ['a-other'])
    queryClient.setQueryData(keyB, ['b'])

    const view = render(<ReviewCommentNotificationBridge />, {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(ctx.observers).toHaveLength(1))
    const first = ctx.observers[0]
    if (first === undefined) throw new Error('expected subscription')

    act(() => {
      first.onChange({ kind: 'review.changed', projectPath: PROJECT })
    })
    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(keyAOther)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBeFalsy()

    // Reset A so project freshness can prove itself independently.
    queryClient.getQueryCache().find({ queryKey: keyA })?.setState({ isInvalidated: false })

    act(() => {
      first.onFreshnessRequired({
        reason: 'sequence-gap',
        scope: { kind: 'project', projectPath: PROJECT },
      })
    })
    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(keyAOther)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBeFalsy()

    // Session-scoped freshness is provider-owned: the bridge must not invalidate.
    queryClient.getQueryCache().find({ queryKey: keyA })?.setState({ isInvalidated: false })
    act(() => {
      first.onFreshnessRequired({
        reason: 'reconnect',
        scope: { kind: 'session' },
      })
    })
    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBeFalsy()

    // Switch environment: unsubscribe A, subscribe B, target only B.
    act(() => {
      ctx.envId = ENV_B
    })
    view.rerender(<ReviewCommentNotificationBridge />)
    await waitFor(() => {
      expect(ctx.observers).toHaveLength(1)
      expect(ctx.observers[0]).not.toBe(first)
    })
    const second = ctx.observers[0]
    if (second === undefined) throw new Error('expected rebound subscription')

    queryClient.getQueryCache().find({ queryKey: keyA })?.setState({ isInvalidated: false })
    queryClient.getQueryCache().find({ queryKey: keyB })?.setState({ isInvalidated: false })

    act(() => {
      second.onChange({ kind: 'review.changed', projectPath: PROJECT })
    })
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBeFalsy()

    view.unmount()
    expect(ctx.observers).toHaveLength(0)
  })

  it('does not subscribe without an active environment', () => {
    ctx.envId = null
    const queryClient = new QueryClient()
    const view = render(<ReviewCommentNotificationBridge />, {
      wrapper: wrapper(queryClient),
    })
    expect(ctx.observers).toHaveLength(0)
    view.unmount()
  })
})
