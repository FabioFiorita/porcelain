import { boardCardsQuery } from '@porcelain/client-runtime/board'
import { gitStatusQuery } from '@porcelain/client-runtime/git'
import {
  reviewActiveQuery,
  reviewEvidenceAssetQuery,
  reviewExploreQuery,
  reviewedPathsQuery,
  reviewIntentQuery,
} from '@porcelain/client-runtime/review'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { reviewNotificationFixtures } from '@porcelain/contracts/review'
import { gitQueryKey } from '@renderer/features/git'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { createDaemonSession, type DaemonSession } from '@renderer/lib/daemon'
import type { SessionSocket, SessionSocketHandlers } from '@renderer/lib/session-browser-adapter'
import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  applyReviewQueryNotification,
  useReviewNotificationSubscription,
} from './review-notifications'
import { reviewQueryKey } from './review-query-key'

const PROJECT = reviewNotificationFixtures['review.changed'].projectPath
const OTHER = '/synthetic/other'
const DAEMON = { host: 'beelink', version: '0.52.1' }

describe('applyReviewQueryNotification', () => {
  it('invalidates exactly the active-review identities for its project', async () => {
    const queryClient = new QueryClient()
    const view = reviewQueryKey(DAEMON, reviewActiveQuery(PROJECT))
    const intent = reviewQueryKey(DAEMON, reviewIntentQuery(PROJECT))
    const asset = reviewQueryKey(DAEMON, reviewEvidenceAssetQuery(PROJECT, 'shot.png'))
    const reviewed = gitQueryKey(DAEMON, reviewedPathsQuery(PROJECT))
    for (const key of [view, intent, asset, reviewed]) queryClient.setQueryData(key, 'seeded')

    applyReviewQueryNotification(reviewNotificationFixtures['review.changed'], {
      daemon: DAEMON,
      queryClient,
    })

    await waitFor(() => expect(queryClient.getQueryState(view)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(intent)?.isInvalidated).toBe(true)
    // The per-file asset family is the one broad effect REV-006 declares.
    expect(queryClient.getQueryState(asset)?.isInvalidated).toBe(true)
    // `reviewed-paths` is Git-keyed and reached through the Git entry (ruling 3).
    expect(queryClient.getQueryState(reviewed)?.isInvalidated).toBe(true)
  })

  it('leaves explore, other domains, and another project alone', async () => {
    const queryClient = new QueryClient()
    const view = reviewQueryKey(DAEMON, reviewActiveQuery(PROJECT))
    const explore = reviewQueryKey(
      DAEMON,
      reviewExploreQuery(PROJECT, { kind: 'file', path: 'src/a.ts' }),
    )
    const otherProject = reviewQueryKey(DAEMON, reviewActiveQuery(OTHER))
    const status = gitQueryKey(DAEMON, gitStatusQuery(PROJECT))
    const board = [boardCardsQuery(PROJECT), DAEMON] as const
    for (const key of [view, explore, otherProject, status, board]) {
      queryClient.setQueryData(key, 'seeded')
    }

    applyReviewQueryNotification(reviewNotificationFixtures['review.changed'], {
      daemon: DAEMON,
      queryClient,
    })

    await waitFor(() => expect(queryClient.getQueryState(view)?.isInvalidated).toBe(true))
    // An exploration is a snapshot of code being read, not of the active review.
    expect(queryClient.getQueryState(explore)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(otherProject)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(status)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(board)?.isInvalidated).toBeFalsy()
  })
})

type FakeSocket = SessionSocket & { readonly handlers: SessionSocketHandlers }

/** A real session over an injected socket: no partial fake, no cast. */
function fakeSession(): { session: DaemonSession; sockets: FakeSocket[] } {
  const sockets: FakeSocket[] = []
  const session = createDaemonSession(
    { url: 'http://127.0.0.1:43118', token: 'synthetic-token' },
    {
      schedule: () => (): void => undefined,
      openSocket: ({ handlers }) => {
        const socket: FakeSocket = {
          handlers,
          send: (): void => undefined,
          close: (): void => undefined,
        }
        sockets.push(socket)
        return socket
      },
    },
  )
  return { session, sockets }
}

describe('useReviewNotificationSubscription', () => {
  it('registers once, ignores other change kinds, and unsubscribes on unmount', async () => {
    const { session, sockets } = fakeSession()
    const onChange = vi.spyOn(session, 'onChange')
    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    })

    const hook = renderHook(
      () => {
        useReviewNotificationSubscription(session)
        return useQueryClient()
      },
      { wrapper },
    )
    const invalidate = vi.spyOn(hook.result.current, 'invalidateQueries')
    session.start()
    await waitFor(() => expect(sockets).toHaveLength(1))
    const socket = sockets[0]
    if (!socket) throw new Error('no socket was opened')
    act(() => socket.handlers.opened())
    act(() =>
      socket.handlers.message(
        JSON.stringify({ t: 'session:ready', protocolVersion: PROTOCOL_VERSION, epoch: 'e1' }),
      ),
    )

    expect(onChange).toHaveBeenCalledTimes(1)

    let sequence = 0
    const deliver = (change: unknown): void => {
      sequence += 1
      act(() =>
        socket.handlers.message(
          JSON.stringify({ t: 'session:change', epoch: 'e1', sequence, change }),
        ),
      )
    }

    invalidate.mockClear()
    deliver({ kind: 'board.changed', projectPath: PROJECT })
    expect(invalidate).not.toHaveBeenCalled()

    deliver({ kind: 'review.changed', projectPath: PROJECT })
    await waitFor(() => expect(invalidate).toHaveBeenCalled())

    hook.unmount()
    invalidate.mockClear()
    deliver({ kind: 'review.changed', projectPath: PROJECT })
    expect(invalidate).not.toHaveBeenCalled()
  })
})
