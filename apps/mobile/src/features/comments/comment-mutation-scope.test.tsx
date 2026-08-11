import type { ReviewComment } from '@porcelain/contracts/review'
import { reviewContractFixtures } from '@porcelain/contracts/review'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCommentActions, useReviewComments } from './comment-data'
import { reviewCommentsQueryKey } from './comment-query-key'
import {
  createCommentHarness,
  deferred,
  PAIRED_ENV,
  REPO,
  type TestDaemonClient,
  type TestPairedEnvironment,
} from './test-support'

/**
 * Regression: mutation callbacks must use the daemon scope captured at public-action
 * invocation, not the live hook environment after a mid-flight switch (RVC-004 review).
 */

const rawFixture = reviewContractFixtures.reviewComments.output[0]
if (rawFixture === undefined) throw new Error('Expected reviewComments fixture')
const FIXTURE: ReviewComment = rawFixture

const ctx = vi.hoisted(() => ({
  clientsByEnvId: new Map<string, TestDaemonClient>(),
  env: null as TestPairedEnvironment | null,
  repoPath: '/synthetic/repo' as string | null,
}))

vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: (env: { id: string }): TestDaemonClient => {
    const scoped = ctx.clientsByEnvId.get(env.id)
    if (scoped === undefined) throw new Error(`no test client for ${env.id}`)
    return scoped
  },
}))

vi.mock('@/lib/daemon/repo', () => ({
  useActiveRepo: () => (ctx.repoPath === null ? null : { path: ctx.repoPath, name: 'repo' }),
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  useActiveEnvironment: () => ctx.env,
}))

beforeEach(() => {
  ctx.clientsByEnvId.clear()
  ctx.env = { ...PAIRED_ENV }
  ctx.repoPath = REPO
})

describe('useCommentActions frozen daemon scope', () => {
  it('keeps queued/in-flight writes on environment A after a live switch to B', async () => {
    const envA: TestPairedEnvironment = { ...PAIRED_ENV, id: 'env-A', token: 'pc_client_A' }
    const envB: TestPairedEnvironment = {
      ...PAIRED_ENV,
      id: 'env-B',
      token: 'pc_client_B',
      baseUrl: 'http://127.0.0.1:43119',
      endpoints: ['http://127.0.0.1:43119'],
      preferredEndpoint: 'http://127.0.0.1:43119',
    }
    const existing = { ...FIXTURE, body: 'original' }
    const writeA = deferred<{ ok: true; value: undefined }>()
    const refetchA = deferred<void>()
    let holdARefetch = false
    let listA: ReviewComment[] = [{ ...existing }]

    const harnessA = createCommentHarness({
      reviewComments: async () => {
        if (holdARefetch) await refetchA.promise
        return { ok: true, value: listA.map((c) => ({ ...c })) }
      },
      editReviewComment: async () => (await writeA.promise) as { ok: true; value: undefined },
    })
    const harnessB = createCommentHarness({
      reviewComments: () => ({ ok: true, value: [{ ...existing, body: 'B list' }] }),
      editReviewComment: () => {
        throw new Error('environment B must not receive the frozen A write')
      },
    })
    ctx.clientsByEnvId.set(envA.id, harnessA.client)
    ctx.clientsByEnvId.set(envB.id, harnessB.client)
    ctx.env = envA

    const keyA = reviewCommentsQueryKey(envA.id, REPO)
    const keyB = reviewCommentsQueryKey(envB.id, REPO)
    harnessA.queryClient.setQueryData(keyB, [{ ...existing, body: 'B list' }])

    const hook = renderHook(
      () => ({
        list: useReviewComments(true),
        ...useCommentActions(),
      }),
      { wrapper: harnessA.wrapper },
    )
    await waitFor(() => expect(hook.result.current.list).toEqual([{ ...existing }]))
    holdARefetch = true
    harnessA.mock.clearRequests()
    harnessB.mock.clearRequests()

    let editing!: Promise<void>
    act(() => {
      editing = hook.result.current.edit(existing.id, 'edited on A')
    })
    await waitFor(() => expect(hook.result.current.list[0]?.body).toBe('edited on A'))
    const cacheA = harnessA.queryClient.getQueryData<readonly ReviewComment[]>(keyA)
    expect(cacheA?.[0]?.body).toBe('edited on A')
    expect(harnessA.queryClient.getQueryData(keyB)).toEqual([{ ...existing, body: 'B list' }])

    act(() => {
      ctx.env = envB
    })
    hook.rerender()

    listA = [{ ...existing, body: 'edited on A' }]
    writeA.resolve({ ok: true, value: undefined })
    refetchA.resolve()
    await editing

    // B may list-query after the switch (read hook); the frozen write must not mutate on B.
    expect(harnessB.mock.requests().filter((r) => r.kind === 'mutation')).toEqual([])
    expect(harnessA.mock.requests().filter((r) => r.procedure === 'editReviewComment')).toEqual([
      {
        procedure: 'editReviewComment',
        kind: 'mutation',
        input: { repoPath: REPO, id: existing.id, body: 'edited on A' },
      },
    ])
    // No observer remains on A after the switch, so settle invalidates without a network refetch.
    await waitFor(() => {
      expect(harnessA.queryClient.getQueryState(keyA)?.isInvalidated).toBe(true)
    })
    expect(harnessA.queryClient.getQueryState(keyB)?.isInvalidated).toBeFalsy()
    expect(harnessA.queryClient.getQueryData(keyB)).toEqual([{ ...existing, body: 'B list' }])
    const settledA = harnessA.queryClient.getQueryData<readonly ReviewComment[]>(keyA)
    expect(settledA?.[0]?.body).toBe('edited on A')
  })
})
