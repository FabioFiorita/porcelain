import { gitStatusQuery } from '@porcelain/client-runtime/git'
import {
  reviewActiveQuery,
  reviewArchivedQuery,
  reviewCommentsQuery,
  reviewedPathsQuery,
  reviewMutations,
} from '@porcelain/client-runtime/review'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { reviewContractFixtures } from '@porcelain/contracts/review'
import { gitQueryKey } from '@renderer/features/git'
import {
  createValidatingTrpcHarness,
  type DaemonMockHandlers,
} from '@renderer/hooks/trpc-test-harness'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reviewCommentsQueryKey } from './comments/comment-query-key'
import {
  useArchiveReview,
  useClearEvidence,
  useDeleteArchivedReview,
  usePublishReview,
  useRestoreArchivedReview,
} from './review-mutations'
import { reviewQueryKey } from './review-query-key'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const F = reviewContractFixtures
const PROJECT = F.activeReview.input
const ARCHIVED_ID = F.restoreArchivedReview.input.id
/** The harness has no daemonInfo answer until it lands, so keys are scoped as unidentified. */
const DAEMON: DaemonScope = { host: null, version: null }

function handlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    archiveReview: () => ({ ok: true, value: undefined }),
    publishReview: () => ({ ok: true, value: F.publishReview.output }),
    restoreArchivedReview: () => ({ ok: true, value: undefined }),
    deleteArchivedReview: () => ({ ok: true, value: undefined }),
    clearEvidence: () => ({ ok: true, value: undefined }),
    ...overrides,
  }
}

const KEYS = {
  archived: () => reviewQueryKey(DAEMON, reviewArchivedQuery(PROJECT)),
  comments: () => reviewCommentsQueryKey(DAEMON, reviewCommentsQuery(PROJECT)),
  gitStatus: () => gitQueryKey(DAEMON, gitStatusQuery(PROJECT)),
  reviewedPaths: () => gitQueryKey(DAEMON, reviewedPathsQuery(PROJECT)),
  active: () => reviewQueryKey(DAEMON, reviewActiveQuery(PROJECT)),
} as const

type KeyName = keyof typeof KEYS

/** Render a mutation hook and hand back the QueryClient it writes through. */
function renderMutation<T>(
  hook: () => T,
  daemonHandlers: DaemonMockHandlers = handlers(),
): { result: { current: { value: T; client: QueryClient } } } {
  const { wrapper } = createValidatingTrpcHarness(daemonHandlers)
  return renderHook(() => ({ client: useQueryClient(), value: hook() }), { wrapper })
}

function seedAll(client: QueryClient): void {
  for (const key of Object.values(KEYS)) client.setQueryData(key(), 'seeded')
}

function staleNames(client: QueryClient): KeyName[] {
  return (Object.keys(KEYS) as KeyName[]).filter(
    (name) => client.getQueryState(KEYS[name]())?.isInvalidated === true,
  )
}

describe('Review mutation adapter', () => {
  beforeEach(() => {
    useProjectSelectionStore.setState({ project: { name: 'repo', path: PROJECT } })
  })

  it('archives through archiveReview and refreshes its effects plus comments', async () => {
    const { result } = renderMutation(useArchiveReview)
    seedAll(result.current.client)

    await result.current.value.archive()

    // `reviewed-paths` is a declared effect that the Git namespace owns (REV-006 ruling 2).
    await waitFor(() =>
      expect(staleNames(result.current.client).sort()).toEqual([
        'active',
        'archived',
        'comments',
        'reviewedPaths',
      ]),
    )
  })

  it('publishes, returns the archive id, and also refreshes gitStatus', async () => {
    const { result } = renderMutation(usePublishReview)
    seedAll(result.current.client)

    const id = await result.current.value.publish()

    expect(id).toBe(F.publishReview.output?.id ?? null)
    await waitFor(() =>
      expect(staleNames(result.current.client).sort()).toEqual([
        'active',
        'archived',
        'comments',
        'gitStatus',
        'reviewedPaths',
      ]),
    )
  })

  it('restores an archived review and also refreshes comments', async () => {
    const { result } = renderMutation(useRestoreArchivedReview)
    seedAll(result.current.client)

    await result.current.value.restore(ARCHIVED_ID)

    await waitFor(() =>
      expect(staleNames(result.current.client).sort()).toEqual([
        'active',
        'archived',
        'comments',
        'reviewedPaths',
      ]),
    )
  })

  it('deletes an archived review and touches neither comments nor gitStatus', async () => {
    const { result } = renderMutation(useDeleteArchivedReview)
    seedAll(result.current.client)

    await result.current.value.remove(ARCHIVED_ID)

    await waitFor(() => expect(staleNames(result.current.client)).toEqual(['archived']))
  })

  it('clears the evidence pack without touching the archive listing', async () => {
    const { result } = renderMutation(useClearEvidence)
    seedAll(result.current.client)

    await result.current.value.clear()

    await waitFor(() => expect(staleNames(result.current.client)).toEqual([]))
    expect(
      reviewMutations.clearEvidence
        .affectedQueries(PROJECT)
        .map((effect) => effect.name)
        .sort(),
    ).toEqual([
      'evidence',
      'evidence-asset-family',
      'evidence-doc-family',
      'publish-cost',
      'reading',
    ])
  })

  it('surfaces its existing error title and leaves the cache untouched on failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(toast.error).mockClear()
    const { result } = renderMutation(
      useArchiveReview,
      handlers({
        archiveReview: () => {
          throw new Error('Archive failed on disk')
        },
      }),
    )
    seedAll(result.current.client)

    await expect(result.current.value.archive()).rejects.toThrow()

    expect(staleNames(result.current.client)).toEqual([])
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Archive review failed',
      expect.objectContaining({ description: expect.any(String) }),
    )
  })

  it('binds only non-optimistic definitions', () => {
    for (const name of [
      'archiveReview',
      'publishReview',
      'restoreArchivedReview',
      'deleteArchivedReview',
      'clearEvidence',
    ] as const) {
      expect(reviewMutations[name].optimistic).toBe(false)
    }
  })
})
