// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockStore } from '../../api/inventory/mock';
import { createMockApi } from '../../api/mock-api';
import type { CommentThread } from '../../domain/comments';
import { createQueryClient } from '../../query/client';
import {
  useWorkspaceContext,
  WorkspaceProvider,
} from '../../query/workspace-provider';
import { ThreadCard } from './thread-card';

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
};

function ConnectionGate({ children }: { children: ReactNode }) {
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

function thread(resolved: boolean): CommentThread {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    worktreeId: scope.worktreeId,
    anchor: { kind: 'file', filePath: 'README.md' },
    resolved,
    messages: [
      {
        id: '00000000-0000-4000-8000-000000000002',
        body: 'Original feedback',
        author: 'agent',
      },
    ],
  };
}

function renderThread(resolved: boolean) {
  const store = createMockStore();
  store.commentsFailed = true;
  const queryClient = createQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={createMockApi(store)}>
        <ConnectionGate>
          <ThreadCard scope={scope} thread={thread(resolved)} />
        </ConnectionGate>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => cleanup());

describe('ThreadCard resolution mutations', () => {
  it('announces a failed resolve mutation', async () => {
    const user = userEvent.setup();
    renderThread(false);

    await user.click(await screen.findByRole('button', { name: 'Resolve' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Comments are unavailable',
    );
  });

  it('announces a failed reopen mutation', async () => {
    const user = userEvent.setup();
    renderThread(true);

    await user.click(await screen.findByRole('button', { name: 'Reopen' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Comments are unavailable',
    );
  });
});
