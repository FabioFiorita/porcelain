// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../api/api';
import { createMockStore } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import type { History } from '../domain/review';
import { createQueryClient } from './client';
import { useHistory } from './history';
import { useWorkspaceContext, WorkspaceProvider } from './workspace-provider';

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
};

function ConnectionGate({ children }: { children: React.ReactNode }) {
  const { api, connection, beginConnection } = useWorkspaceContext();
  useEffect(() => {
    if (connection) return;
    const controller = new AbortController();
    void api.inventory
      .read({
        token: 'fixture-token',
        signal: controller.signal,
        refresh: false,
      })
      .then((inventory) => {
        beginConnection()?.('fixture-token', inventory);
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
      nextCursor: 'page-2',
    },
    second: {
      ...fixture.history,
      commits: [older],
      nextCursor: null,
    },
  } satisfies { first: History; second: History };
}

function renderHistory(api: Api) {
  const queryClient = createQueryClient();
  render(
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
  cleanup();
  vi.restoreAllMocks();
});

describe('history query', () => {
  it('accumulates cursor pages and only sends the returned cursor for older history', async () => {
    const store = createMockStore();
    const baseApi = createMockApi(store);
    const pages = pagesFor(store);
    const cursors: (string | undefined)[] = [];
    const api: Api = {
      ...baseApi,
      review: {
        ...baseApi.review,
        history: async (request) => {
          cursors.push(request.cursor);
          return request.cursor == null ? pages.first : pages.second;
        },
      },
    };

    renderHistory(api);
    await screen.findByText('Keep review context scoped to the worktree');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Load older' }));

    await waitFor(() =>
      expect(screen.getByLabelText('history').textContent).toContain(
        'Add keyboard navigation to the workspace',
      ),
    );
    expect(cursors).toEqual([undefined, 'page-2']);
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
          if (request.cursor == null) return pages.first;
          olderCalls += 1;
          if (olderCalls === 1) throw new Error('temporary history failure');
          return pages.second;
        },
      },
    };

    renderHistory(api);
    await screen.findByText('Keep review context scoped to the worktree');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Load older' }));
    await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByLabelText('history').textContent).toContain(
      'Keep review context scoped to the worktree',
    );

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(screen.getByLabelText('history').textContent).toContain(
        'Add keyboard navigation to the workspace',
      ),
    );
    expect(olderCalls).toBe(2);
  });
});
