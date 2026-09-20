import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { Api } from '../api/api';
import { createMockStore, mockEnvironmentId } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import type {
  Change,
  ChangeList,
  ReviewedMarksResponse,
} from '../domain/review';
import { createQueryClient } from './client';
import { queryKeys } from './keys';
import {
  mergeReviewChanges,
  useChangeDiffs,
  useCommit,
  useMarkAllReviewed,
  useMarkReviewed,
  useReviewChanges,
  useUnmarkReviewed,
} from './review';
import { useWorkspaceContext, WorkspaceProvider } from './workspace-provider';

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a86281cd6456281a29c05fba76b4b',
};

function ConnectionGate({ children }: { children: React.ReactNode }) {
  const { api, connection, beginConnection } = useWorkspaceContext();
  useEffect(() => {
    if (connection) return;
    const controller = new AbortController();
    // Connect the way a browser does: redeem a link, then hold the cookie.
    void api.pairing
      .redeem({
        code: 'fixture-code',
        environmentId: mockEnvironmentId,
        signal: controller.signal,
      })
      .then((inventory) => {
        beginConnection()?.(inventory);
      });
    return () => controller.abort();
  }, [api, beginConnection, connection]);
  return connection ? children : <span>Connecting</span>;
}

function BulkHarness({
  onConnection,
}: {
  onConnection?: (controller: AbortController) => void;
} = {}) {
  const { connection } = useWorkspaceContext();
  const changes = useReviewChanges(scope);
  const bulk = useMarkAllReviewed(scope);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (connection) onConnection?.(connection.controller);
  }, [connection, onConnection]);
  return (
    <>
      <output aria-label="Change paths">
        {changes
          .map((entry) => `${entry.path}:${entry.reviewStatus}`)
          .join('|')}
      </output>
      <button
        type="button"
        onClick={() =>
          void bulk
            .submit(changes)
            .then((report) =>
              setMessage(
                `${report.marked.length}/${report.skipped.length}/${report.failed.length}`,
              ),
            )
            .catch((error: unknown) =>
              setMessage(
                `error:${error instanceof Error ? error.message : 'unknown'}`,
              ),
            )
        }
      >
        Mark all
      </button>
      <output aria-label="Bulk result">{message}</output>
    </>
  );
}

/** One document's worth of hunks, read the way the review surface reads them. */
function DiffHarness() {
  const changes = useReviewChanges(scope);
  const tracked = changes.filter((entry) =>
    entry.comparisons.some(
      (change) => change.scope === 'staged' || change.scope === 'unstaged',
    ),
  );
  const { diffs } = useChangeDiffs(
    scope,
    tracked[0]?.statusToken ?? '',
    tracked.map((entry) => ({
      path: entry.path,
      fingerprint: entry.fingerprint,
    })),
    tracked.flatMap((entry) =>
      entry.comparisons.flatMap((change) =>
        change.scope === 'staged' || change.scope === 'unstaged'
          ? [
              {
                scope: change.scope,
                oldPath: change.oldPath,
                newPath: change.newPath,
              },
            ]
          : [],
      ),
    ),
  );
  return (
    <output aria-label="Diff patches">
      {[...diffs.values()]
        .map((content) => ('patch' in content ? content.patch : content.kind))
        .join('')}
    </output>
  );
}

function MutationHarness() {
  const changes = useReviewChanges(scope);
  const mark = useMarkReviewed(scope);
  const unmark = useUnmarkReviewed(scope);
  const entry = changes[0];
  if (!entry || entry.fingerprint == null) return <span>Waiting</span>;
  const path = entry.path;
  const fingerprint = entry.fingerprint;
  return (
    <>
      <output aria-label="Mutation path">{entry.path}</output>
      <button
        type="button"
        onClick={() =>
          void mark.submit({ path, fingerprint }).catch(() => undefined)
        }
      >
        Mark one
      </button>
      <button
        type="button"
        onClick={() => void unmark.submit(path).catch(() => undefined)}
      >
        Unmark one
      </button>
    </>
  );
}

function CommitHarness({ oid, parent }: { oid: string; parent?: number }) {
  const commit = useCommit(scope, oid, parent);
  return (
    <output aria-label="commit comparison">
      {commit.comparison.kind === 'parent'
        ? `${commit.comparison.parentNumber}:${commit.comparison.baseOid}`
        : 'empty-tree'}
    </output>
  );
}

async function renderReview(
  store = createMockStore(),
  api = createMockApi(store),
  harness: React.ReactNode = <BulkHarness />,
) {
  const queryClient = createQueryClient();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={api}>
        <ConnectionGate>
          <Suspense fallback={<span>Loading review</span>}>{harness}</Suspense>
        </ConnectionGate>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  return { store, queryClient, screen };
}

afterEach(() => {
  focusManager.setFocused(undefined);
  vi.restoreAllMocks();
});

describe('review change queries', () => {
  it('keeps a selected merge parent in the query identity and request', async () => {
    const store = createMockStore();
    const fixture = store.review[scope.worktreeId];
    const firstCommit = fixture?.history.commits[0];
    if (!firstCommit) throw new Error('Missing fixture commit');
    firstCommit.parentOids.push('c'.repeat(40));

    const baseApi = createMockApi(store);
    const parentCalls: Array<number | undefined> = [];
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        async commit(request) {
          parentCalls.push(request.parent);
          return baseApi.review.commit(request);
        },
      },
    };

    const { queryClient, screen } = await renderReview(
      store,
      api,
      <CommitHarness oid={firstCommit.oid} parent={2} />,
    );

    await expect
      .element(screen.getByLabelText('commit comparison'))
      .toHaveTextContent(`2:${'c'.repeat(40)}`);
    expect(parentCalls).toEqual([2]);
    expect(
      queryClient.getQueryData(
        queryKeys.reviewSurface(store.inventory.environmentId, scope, [
          'commit',
          firstCommit.oid,
          2,
        ]),
      ),
    ).toBeTruthy();
  });

  /**
   * A commit cannot change and its id is in the key, so coming back to the
   * window has nothing to find out. History itself already says as much; the
   * commit open inside it was still asking.
   */
  it('does not read an open commit again when the window regains focus', async () => {
    const store = createMockStore();
    const fixture = store.review[scope.worktreeId];
    const firstCommit = fixture?.history.commits[0];
    if (!firstCommit) throw new Error('Missing fixture commit');
    const baseApi = createMockApi(store);
    let reads = 0;
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        async commit(request) {
          reads += 1;
          return baseApi.review.commit(request);
        },
      },
    };

    const { screen } = await renderReview(
      store,
      api,
      <CommitHarness oid={firstCommit.oid} parent={1} />,
    );
    await expect
      .element(screen.getByLabelText('commit comparison'))
      .toBeVisible();
    expect(reads).toBe(1);

    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await expect.poll(() => reads).toBe(1);
  });

  it('selects a logical path without dropping its staged and unstaged comparisons', () => {
    const staged: Extract<Change, { kind: string }> = {
      scope: 'staged',
      kind: 'modified',
      oldPath: 'README.md',
      newPath: 'README.md',
      oldMode: '100644',
      newMode: '100644',
      oldOid: 'a'.repeat(40),
      newOid: 'd'.repeat(40),
      supported: true,
    };
    const unstaged = { ...staged, scope: 'unstaged' as const };
    const fingerprint = 'b'.repeat(64);
    const list: ChangeList = {
      environmentId: '7fe18f78-1477-4c19-a42b-cdd42f862151',
      worktreeId: scope.worktreeId,
      statusToken: 'c'.repeat(64),
      headOid: null,
      branch: null,
      changes: [
        { path: 'README.md', fingerprint, comparisons: [staged, unstaged] },
      ],
    };

    const selected = mergeReviewChanges(
      list,
      { worktreeId: scope.worktreeId, marks: [] },
      ['README.md'],
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.comparisons).toHaveLength(2);
    expect(selected[0]?.fingerprint).toBe(fingerprint);
  });

  /**
   * Returning to the window is the natural refresh boundary for everything
   * else, and deliberately not for these two. The list is what a diff and a
   * mark are checked against: re-reading it under a reader who has not moved
   * would throw away the hunks on screen and the fingerprint beside them.
   */
  it('does not re-read the change list or its hunks when the window is focused', async () => {
    const store = createMockStore();
    const base = createMockApi(store);
    let lists = 0;
    let diffs = 0;
    const api: Api = {
      ...base,
      review: {
        ...base.review,
        changes: (request) => {
          lists += 1;
          return base.review.changes(request);
        },
        diffs: (request) => {
          diffs += 1;
          return base.review.diffs(request);
        },
      },
    };
    const { screen } = await renderReview(store, api, <DiffHarness />);
    await expect
      .element(screen.getByLabelText('Diff patches'))
      .toMatchTextContent(/@@/);
    const before = { lists, diffs };
    expect(before.lists).toBeGreaterThan(0);
    expect(before.diffs).toBeGreaterThan(0);

    focusManager.setFocused(false);
    focusManager.setFocused(true);
    // Long enough for a refetch to have been started and finished.
    await new Promise((settle) => setTimeout(settle, 150));
    expect({ lists, diffs }).toEqual(before);
  });

  it('marks fingerprintable paths and reports null-fingerprint paths as skipped', async () => {
    const store = createMockStore();
    const fixture = store.review[scope.worktreeId];
    if (!fixture) throw new Error('Missing fixture review');
    fixture.git.comparisons.push({
      scope: 'unmerged',
      path: 'conflict.ts',
      conflict: 'UU',
    });
    const { screen } = await renderReview(store);

    await expect.element(screen.getByLabelText('Change paths')).toBeVisible();
    await expect
      .element(screen.getByLabelText('Change paths'))
      .toMatchTextContent('conflict.ts:unreviewed');
    await screen.getByRole('button', { name: 'Mark all' }).click();
    await expect
      .element(screen.getByLabelText('Bulk result'))
      .toHaveTextContent('6/1/0');
    expect(store.reviewed[scope.worktreeId]).not.toContainEqual(
      expect.objectContaining({ path: 'conflict.ts' }),
    );
  });

  it('keeps reviewed state scoped to the selected worktree', async () => {
    const store = createMockStore();
    const api = createMockApi(store);
    const { changes } = await api.review.changes({
      ...scope,
      signal: new AbortController().signal,
    });
    const first = changes.changes[0];
    if (!first?.fingerprint) throw new Error('Missing markable change');
    await api.review.reviewed.set({
      ...scope,
      signal: new AbortController().signal,
      input: {
        path: first.path,
        reviewed: true,
        fingerprint: first.fingerprint,
      },
    });
    const other = {
      ...scope,
      worktreeId: '629a86281cd6456281a29c05fba76b4c',
    };
    await expect(
      api.review.reviewed.list({
        ...other,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ worktreeId: other.worktreeId, marks: [] });
  });

  it('uses each bulk response as the authoritative snapshot after a concurrent unmark', async () => {
    const store = createMockStore();
    const baseApi = createMockApi(store);
    const oldMark = {
      path: 'old.ts',
      fingerprint: 'a'.repeat(64),
      reviewedAt: '2026-09-12T00:00:00.000Z',
    };
    store.reviewed[scope.worktreeId] = [oldMark];
    let setCalls = 0;
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        reviewed: {
          ...baseApi.review.reviewed,
          async set(request) {
            setCalls += 1;
            const result = await baseApi.review.reviewed.set(request);
            if (setCalls === 1) {
              await baseApi.review.reviewed.remove({
                ...request,
                path: oldMark.path,
              });
            }
            return result;
          },
        },
      },
    };

    const { queryClient, screen } = await renderReview(store, api);
    await expect.element(screen.getByLabelText('Change paths')).toBeVisible();
    await screen.getByRole('button', { name: 'Mark all' }).click();
    await expect
      .element(screen.getByLabelText('Bulk result'))
      .toHaveTextContent('6/0/0');

    const snapshot = queryClient.getQueryData<ReviewedMarksResponse>(
      queryKeys.reviewSurface(store.inventory.environmentId, scope, [
        'reviewed',
      ]),
    );
    expect(snapshot?.marks).not.toContainEqual(oldMark);
    expect(snapshot?.marks).toHaveLength(6);
  });

  it('keeps a later unmark intent when an earlier mark response is delayed', async () => {
    const store = createMockStore();
    const baseApi = createMockApi(store);
    let setCalls = 0;
    let removeCalls = 0;
    let markStarted!: () => void;
    let releaseMark!: () => void;
    const markStartedPromise = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const markResponse = new Promise<void>((resolve) => {
      releaseMark = resolve;
    });
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        reviewed: {
          ...baseApi.review.reviewed,
          async set(request) {
            setCalls += 1;
            const result = await baseApi.review.reviewed.set(request);
            markStarted();
            await markResponse;
            return result;
          },
          async remove(request) {
            removeCalls += 1;
            return baseApi.review.reviewed.remove(request);
          },
        },
      },
    };

    const { queryClient, screen } = await renderReview(
      store,
      api,
      <MutationHarness />,
    );
    await expect.element(screen.getByLabelText('Mutation path')).toBeVisible();
    const path = (await screen.getByLabelText('Mutation path').element())
      .textContent;
    await screen.getByRole('button', { name: 'Mark one' }).click();
    await markStartedPromise;
    const reviewedKey = queryKeys.reviewSurface(
      store.inventory.environmentId,
      scope,
      ['reviewed'],
    );
    expect(
      queryClient.getQueryData<ReviewedMarksResponse>(reviewedKey)?.marks,
    ).toContainEqual(expect.objectContaining({ path }));
    await screen.getByRole('button', { name: 'Unmark one' }).click();
    expect(removeCalls).toBe(0);
    await vi.waitFor(() =>
      expect(
        queryClient.getQueryData<ReviewedMarksResponse>(reviewedKey)?.marks,
      ).not.toContainEqual(expect.objectContaining({ path })),
    );

    releaseMark();
    await vi.waitFor(() => expect(removeCalls).toBe(1));
    await vi.waitFor(() =>
      expect(queryClient.getQueryState(reviewedKey)?.fetchStatus).toBe('idle'),
    );
    expect(
      queryClient.getQueryData<ReviewedMarksResponse>(reviewedKey)?.marks,
    ).not.toContainEqual(expect.objectContaining({ path }));
    expect(setCalls).toBe(1);
  });

  it('keeps a reviewed mutation when an older focus read resolves last', async () => {
    const store = createMockStore();
    const baseApi = createMockApi(store);
    let listCalls = 0;
    let readStarted!: () => void;
    let releaseRead!: () => void;
    const readStartedPromise = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    const delayedRead = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const staleSnapshot: ReviewedMarksResponse = {
      worktreeId: scope.worktreeId,
      marks: [],
    };
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        reviewed: {
          ...baseApi.review.reviewed,
          async list(request) {
            listCalls += 1;
            if (listCalls === 1) return baseApi.review.reviewed.list(request);
            readStarted();
            await delayedRead;
            return staleSnapshot;
          },
        },
      },
    };

    const { queryClient, screen } = await renderReview(
      store,
      api,
      <MutationHarness />,
    );
    const path = (await screen.getByLabelText('Mutation path').element())
      .textContent;
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await readStartedPromise;
    await screen.getByRole('button', { name: 'Mark one' }).click();

    const key = queryKeys.reviewSurface(store.inventory.environmentId, scope, [
      'reviewed',
    ]);
    await vi.waitFor(() =>
      expect(
        queryClient.getQueryData<ReviewedMarksResponse>(key)?.marks,
      ).toContainEqual(expect.objectContaining({ path })),
    );
    releaseRead();
    await vi.waitFor(() =>
      expect(queryClient.getQueryState(key)?.fetchStatus).toBe('idle'),
    );
    expect(
      queryClient.getQueryData<ReviewedMarksResponse>(key)?.marks,
    ).toContainEqual(expect.objectContaining({ path }));
  });

  it('reports a request timeout after earlier successes and keeps their cache snapshot', async () => {
    const store = createMockStore();
    const baseApi = createMockApi(store);
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    let setCalls = 0;
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        reviewed: {
          ...baseApi.review.reviewed,
          async set(request) {
            setCalls += 1;
            if (setCalls === 2) {
              await new Promise<never>((_, reject) => {
                request.signal.addEventListener(
                  'abort',
                  () => reject(request.signal.reason),
                  { once: true },
                );
              });
            }
            return baseApi.review.reviewed.set(request);
          },
        },
      },
    };

    const { queryClient, screen } = await renderReview(store, api);
    await expect.element(screen.getByLabelText('Change paths')).toBeVisible();
    await screen.getByRole('button', { name: 'Mark all' }).click();
    await vi.waitFor(() => expect(setCalls).toBe(2));
    timeout.abort(new DOMException('The request timed out.', 'TimeoutError'));

    await expect
      .element(screen.getByLabelText('Bulk result'))
      .toHaveTextContent('1/0/5');
    const snapshot = queryClient.getQueryData<ReviewedMarksResponse>(
      queryKeys.reviewSurface(store.inventory.environmentId, scope, [
        'reviewed',
      ]),
    );
    expect(snapshot?.marks).toHaveLength(1);
  });

  it('stops bulk review on connection cancellation instead of reporting success', async () => {
    const store = createMockStore();
    const baseApi = createMockApi(store);
    let setCalls = 0;
    let connectionController: AbortController | undefined;
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        reviewed: {
          ...baseApi.review.reviewed,
          async set(request) {
            setCalls += 1;
            await new Promise<never>((_, reject) => {
              request.signal.addEventListener(
                'abort',
                () => reject(request.signal.reason),
                { once: true },
              );
            });
            return baseApi.review.reviewed.set(request);
          },
        },
      },
    };

    const { screen } = await renderReview(
      store,
      api,
      <BulkHarness
        onConnection={(controller) => {
          connectionController = controller;
        }}
      />,
    );
    await expect.element(screen.getByLabelText('Change paths')).toBeVisible();
    await screen.getByRole('button', { name: 'Mark all' }).click();
    await vi.waitFor(() => expect(setCalls).toBe(1));
    if (!connectionController) throw new Error('Missing connection controller');
    connectionController.abort(new DOMException('Disconnected', 'AbortError'));

    await expect
      .element(screen.getByLabelText('Bulk result'))
      .toMatchTextContent(/^error:/);
    expect(store.reviewed[scope.worktreeId]).toEqual([]);
  });
});
