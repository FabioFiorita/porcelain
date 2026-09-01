import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const fixtures = vi.hoisted(() => {
  type Change = { kind: 'review.changed'; projectPath: string }
  const localListeners = new Set<(change: Change) => void>()
  const remoteListeners = new Set<(change: Change) => void>()
  const session = (listeners: Set<(change: Change) => void>) => ({
    start: vi.fn(),
    onChange: vi.fn((listener: (change: Change) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
  })
  return {
    localListeners,
    remoteListeners,
    localSession: session(localListeners),
    remoteSession: session(remoteListeners),
  }
})

vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => ({ host: 'local-host', version: '0.61.4', platform: 'darwin' }),
}))

vi.mock('@renderer/lib/environment-sessions', () => ({
  daemonScopeForEnvironment: (
    environmentId: string | null,
    identity: { host: string | null; version: string | null },
  ) => ({ host: environmentId ?? identity.host, version: identity.version }),
  liveEnvironmentSessions: () => [
    {
      environmentId: 'env-local',
      connectionId: null,
      name: 'This device',
      session: fixtures.localSession,
      client: {},
    },
    {
      environmentId: 'env-remote',
      connectionId: 'connection-remote',
      name: 'Remote',
      session: fixtures.remoteSession,
      client: {},
    },
  ],
  useEnvironmentSessionsRevision: () => 1,
}))

import { useReviewCommentNotificationSubscription } from './comment-notifications'

describe('Review comment notification subscriptions', () => {
  it('subscribes to local and secondary sessions and invalidates under the emitting owner', () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    renderHook(() => useReviewCommentNotificationSubscription(), { wrapper })
    expect(fixtures.localSession.start).toHaveBeenCalledOnce()
    expect(fixtures.remoteSession.start).toHaveBeenCalledOnce()

    act(() => {
      for (const listener of fixtures.remoteListeners) {
        listener({ kind: 'review.changed', projectPath: '/remote/repo' })
      }
    })

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [
        { domain: 'review', name: 'comments', projectPath: '/remote/repo' },
        { host: 'env-remote', version: '0.61.4' },
      ],
      exact: true,
    })
  })
})
