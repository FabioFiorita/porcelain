import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { Api } from '../api/api';
import { createMockStore, mockEnvironmentId } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import type { History } from '../domain/review';
import { createQueryClient } from './client';
import { useHistory } from './history';
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

function HistoryHarness() {
  const history = useHistory(scope);
  return (
    <>
      <output aria-label="history">
        {history.commits.map((commit) => commit.subject).join('|')}
      </output>
      <output aria-label="restarted">{String(history.restarted)}</output>
      {history.hasNextPage && (
        <button
          type="button"
          onClick={() => void history.fetchNextPage().catch(() => undefined)}
        >
          Load older
        </button>
      )}
      {history.isFetchNextPageError && (
        <button
          type="button"
          onClick={() => void history.fetchNextPage().catch(() => undefined)}
        >
          Retry
        </button>
      )}
    </>
  );
}

function pagesFor(store: ReturnType<typeof createMockStore>) {
  const fixture = store.review[scope.worktreeId];
  if (!fixture) throw new Error('Missing history fixture');
  const [tip, older] = fixture.history.commits;
  if (!tip || !older) throw new Error('Missing history commits');
  return {
    first: {
      ...fixture.history,
      commits: [tip],
      nextAfter: ['b'.repeat(40)],
      tip: 'a'.repeat(40),
    },
    second: {
      ...fixture.history,
      commits: [older],
      nextAfter: null,
      tip: 'a'.repeat(40),
    },
  } satisfies { first: History; second: History };
}

async function renderHistory(api: Api) {
  const queryClient = createQueryClient();
  return await render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={api}>
        <ConnectionGate>
          <Suspense fallback={<span>Loading history</span>}>
            <HistoryHarness />
          </Suspense>
        </ConnectionGate>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('history query', () => {
  it('accumulates pages and asks for older history after the last commit shown', async () => {
    const store = createMockStore();
    const baseApi = createMockApi(store);
    const pages = pagesFor(store);
    const anchors: (string | undefined)[] = [];
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        history: async (request) => {
          anchors.push(request.after?.join(','));
          return request.after == null ? pages.first : pages.second;
        },
      },
    };

    const screen = await renderHistory(api);
    await expect
      .element(screen.getByText('Keep review context scoped to the worktree'))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Load older' }).click();

    await expect
      .element(screen.getByLabelText('history'))
      .toMatchTextContent('Add keyboard navigation to the workspace');
    expect(anchors).toEqual([undefined, 'b'.repeat(40)]);
  });

  /**
   * The branch was rewritten under the reader: what they were scrolling is
   * gone, so the page that comes back replaces it rather than continuing it.
   */
  it('replaces the list when history restarts from the top', async () => {
    const store = createMockStore();
    const baseApi = createMockApi(store);
    const pages = pagesFor(store);
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        history: async (request) =>
          request.after == null
            ? pages.first
            : { ...pages.second, restarted: true },
      },
    };

    const screen = await renderHistory(api);
    await expect
      .element(screen.getByText('Keep review context scoped to the worktree'))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Load older' }).click();
    await expect
      .element(screen.getByLabelText('history'))
      .toMatchTextContent('Add keyboard navigation to the workspace');
    // The commits from before the restart are not kept above the new ones.
    await expect
      .element(screen.getByLabelText('history'))
      .not.toMatchTextContent('Keep review context scoped to the worktree');
    await expect
      .element(screen.getByLabelText('restarted'))
      .toMatchTextContent('true');
  });

  /**
   * The notice belongs to the page that restarted, not to the list for as long
   * as it is open: reading on past it is what says the reader has seen it.
   */
  it('clears the restarted notice once a later page succeeds', async () => {
    const store = createMockStore();
    const baseApi = createMockApi(store);
    const pages = pagesFor(store);
    let calls = 0;
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        history: async (request) => {
          if (request.after == null) return pages.first;
          calls += 1;
          // The first continuation restarted; the one after it did not.
          return calls === 1
            ? {
                ...pages.second,
                restarted: true,
                nextAfter: ['c'.repeat(40)],
                tip: 'a'.repeat(40),
              }
            : { ...pages.second, restarted: false, nextAfter: null };
        },
      },
    };

    const screen = await renderHistory(api);
    await screen.getByRole('button', { name: 'Load older' }).click();
    await expect
      .element(screen.getByLabelText('restarted'))
      .toMatchTextContent('true');

    await screen.getByRole('button', { name: 'Load older' }).click();
    await expect
      .element(screen.getByLabelText('restarted'))
      .toMatchTextContent('false');
  });

  it('retains loaded commits and succeeds after explicitly retrying a failed page', async () => {
    const store = createMockStore();
    const baseApi = createMockApi(store);
    const pages = pagesFor(store);
    let olderCalls = 0;
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        history: async (request) => {
          if (request.after == null) return pages.first;
          olderCalls += 1;
          if (olderCalls === 1) throw new Error('temporary history failure');
          return pages.second;
        },
      },
    };

    const screen = await renderHistory(api);
    await expect
      .element(screen.getByText('Keep review context scoped to the worktree'))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Load older' }).click();
    await expect
      .element(screen.getByRole('button', { name: 'Retry' }))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText('history'))
      .toMatchTextContent('Keep review context scoped to the worktree');

    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect
      .element(screen.getByLabelText('history'))
      .toMatchTextContent('Add keyboard navigation to the workspace');
    expect(olderCalls).toBe(2);
  });
});
