import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { createMockStore, mockEnvironmentId } from '../../api/inventory/mock';
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
  worktreeId: '629a86281cd6456281a29c05fba76b4b',
};

function ConnectionGate({ children }: { children: ReactNode }) {
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
    revision: 1,
  };
}

async function renderThread(resolved: boolean) {
  const store = createMockStore();
  store.commentsFailed = true;
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={createMockApi(store)}>
        <ConnectionGate>
          <ThreadCard scope={scope} thread={thread(resolved)} />
        </ConnectionGate>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('ThreadCard resolution mutations', () => {
  it('announces a failed resolve mutation', async () => {
    const screen = await renderThread(false);

    await screen.getByRole('button', { name: 'Resolve' }).click();

    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('Comments are unavailable');
  });

  it('announces a failed reopen mutation', async () => {
    const screen = await renderThread(true);

    await screen.getByRole('button', { name: 'Reopen' }).click();

    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('Comments are unavailable');
  });

  it('reuses the pending message id when the owner retries an unchanged reply', async () => {
    const screen = await renderThread(false);
    await screen.getByRole('button', { name: 'Reply' }).click();
    await screen.getByRole('textbox', { name: 'Reply' }).fill('Please retry');
    const randomUUID = vi.spyOn(crypto, 'randomUUID');

    await screen.getByRole('button', { name: 'Post reply' }).click();
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('Comments are unavailable');
    await screen.getByRole('button', { name: 'Post reply' }).click();
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('Comments are unavailable');

    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});
