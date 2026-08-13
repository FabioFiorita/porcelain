import { boardCardsQuery } from '@porcelain/client-runtime/board'
import { gitHeadQuery } from '@porcelain/client-runtime/git'
import {
  reviewArchivedQuery,
  reviewEvidenceAssetQuery,
  reviewIntentQuery,
  reviewReadingQuery,
  worktreeInboxQuery,
} from '@porcelain/client-runtime/review'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { SessionChange } from '@porcelain/contracts/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ENVIRONMENT = 'env-review-notify'
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other'

const ctx = vi.hoisted(() => ({
  subscriptions: 0,
  unsubscriptions: 0,
  onChange: null as ((change: SessionChange) => void) | null,
  onFreshnessRequired: null as ((requirement: FreshnessRequirement) => void) | null,
}))

/**
 * The subject is the Review notification bridge. `features/changes/use-changes` (ruling 5's
 * forward) reaches Git and Remote for reads this test never renders; stubbing those two keeps
 * the module graph off the native runtime without faking any invalidation behavior.
 */
vi.mock('@/features/git', () => ({
  useGitFlow: () => ({ error: null, groups: undefined, isLoading: false }),
  useGitRangeFlow: () => ({ base: undefined, error: null, groups: undefined, isLoading: false }),
}))

vi.mock('@/features/remote', () => ({
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ({ id: ENVIRONMENT, token: 'pc_client_test' }),
}))

vi.mock('@/lib/daemon/session', () => ({
  subscribeSessionChanges: (handlers: {
    onChange: (change: SessionChange) => void
    onFreshnessRequired: (requirement: FreshnessRequirement) => void
  }): (() => void) => {
    ctx.subscriptions += 1
    ctx.onChange = handlers.onChange
    ctx.onFreshnessRequired = handlers.onFreshnessRequired
    return () => {
      ctx.unsubscriptions += 1
    }
  },
}))

import {
  applyReviewFreshnessRequirement,
  applyReviewNotification,
  ReviewNotificationBridge,
} from './review-notifications'
import { reviewQueryKey } from './review-query-key'

function seed(queryClient: QueryClient): {
  reading: readonly unknown[]
  intent: readonly unknown[]
  asset: readonly unknown[]
  archived: readonly unknown[]
  other: readonly unknown[]
  inbox: readonly unknown[]
  git: readonly unknown[]
  board: readonly unknown[]
  reviewedPaths: readonly unknown[]
} {
  const keys = {
    archived: reviewQueryKey(ENVIRONMENT, reviewArchivedQuery(PROJECT)),
    asset: reviewQueryKey(ENVIRONMENT, reviewEvidenceAssetQuery(PROJECT, 'shot.png')),
    board: ['daemon', ENVIRONMENT, boardCardsQuery(PROJECT)] as const,
    git: ['daemon', ENVIRONMENT, gitHeadQuery(PROJECT)] as const,
    inbox: reviewQueryKey(ENVIRONMENT, worktreeInboxQuery(PROJECT)),
    intent: reviewQueryKey(ENVIRONMENT, reviewIntentQuery(PROJECT)),
    other: reviewQueryKey(ENVIRONMENT, reviewReadingQuery(OTHER_PROJECT)),
    reading: reviewQueryKey(ENVIRONMENT, reviewReadingQuery(PROJECT)),
    reviewedPaths: ['daemon', ENVIRONMENT, 'reviewedPaths', PROJECT] as const,
  }
  for (const key of Object.values(keys)) queryClient.setQueryData(key, {})
  return keys
}

beforeEach(() => {
  ctx.subscriptions = 0
  ctx.unsubscriptions = 0
  ctx.onChange = null
  ctx.onFreshnessRequired = null
})

describe('Mobile Review notification bridge', () => {
  it('invalidates exactly the active-review identities of the changed project', async () => {
    const queryClient = new QueryClient()
    const keys = seed(queryClient)

    applyReviewNotification(
      { kind: 'review.changed', projectPath: PROJECT },
      { environmentId: ENVIRONMENT, queryClient },
    )
    await waitFor(() => expect(queryClient.getQueryState(keys.reading)?.isInvalidated).toBe(true))

    expect(queryClient.getQueryState(keys.intent)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(keys.asset)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(keys.archived)?.isInvalidated).toBe(true)
    // Reviewed marks stay Changes-owned and are reached through ruling 5's forward.
    expect(queryClient.getQueryState(keys.reviewedPaths)?.isInvalidated).toBe(true)
    // Another project, the cross-worktree Git scan, Board and Git keep their own owners.
    expect(queryClient.getQueryState(keys.other)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(keys.inbox)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(keys.git)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(keys.board)?.isInvalidated).toBeFalsy()
  })

  it('recovers every Review identity for a session and one project for a gap', async () => {
    const queryClient = new QueryClient()
    const keys = seed(queryClient)

    applyReviewFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      { environmentId: ENVIRONMENT, queryClient },
    )
    await waitFor(() => expect(queryClient.getQueryState(keys.reading)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(keys.other)?.isInvalidated).toBeFalsy()

    applyReviewFreshnessRequirement(
      { reason: 'epoch-changed', scope: { kind: 'session' } },
      { environmentId: ENVIRONMENT, queryClient },
    )
    await waitFor(() => expect(queryClient.getQueryState(keys.other)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(keys.git)?.isInvalidated).toBeFalsy()
  })

  it('subscribes once, ignores other changes, and unsubscribes on unmount', async () => {
    const queryClient = new QueryClient()
    const keys = seed(queryClient)
    const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { unmount, rerender } = renderHook(() => ReviewNotificationBridge(), { wrapper })
    rerender()
    expect(ctx.subscriptions).toBe(1)

    ctx.onChange?.({ kind: 'board.changed', projectPath: PROJECT })
    ctx.onChange?.({ kind: 'git.working-tree-changed', projectPath: PROJECT })
    await Promise.resolve()
    expect(queryClient.getQueryState(keys.reading)?.isInvalidated).toBeFalsy()

    ctx.onChange?.({ kind: 'review.changed', projectPath: PROJECT })
    await waitFor(() => expect(queryClient.getQueryState(keys.reading)?.isInvalidated).toBe(true))

    unmount()
    expect(ctx.unsubscriptions).toBe(1)
  })
})
