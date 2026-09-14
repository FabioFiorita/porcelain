// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useEffect } from 'react';
import { afterEach, expect, it } from 'vitest';
import { createMockStore } from '../../api/inventory/mock';
import { createMockApi } from '../../api/mock-api';
import type { CommentThread } from '../../domain/comments';
import { createQueryClient } from '../../query/client';
import {
  useWorkspaceContext,
  WorkspaceProvider,
} from '../../query/workspace-provider';
import { FileComments } from './file-comments';

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
};
const otherScope = {
  ...scope,
  worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4c',
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

function seededThread(worktreeId = scope.worktreeId): CommentThread {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    worktreeId,
    anchor: { kind: 'file', filePath: 'src/components/review-panel.tsx' },
    resolved: false,
    messages: [
      {
        id: '00000000-0000-4000-8000-000000000002',
        body: 'Agent context for this file',
        author: 'agent',
      },
    ],
  };
}

function renderComments(
  store = createMockStore(),
  children: ReactNode = (
    <FileComments scope={scope} path="src/components/review-panel.tsx" />
  ),
) {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={createMockApi(store)}>
        <ConnectionGate>{children}</ConnectionGate>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  return { store, queryClient };
}

afterEach(() => cleanup());

it('shows author identity, replies to a thread, and toggles resolution accessibly', async () => {
  const store = createMockStore();
  store.comments[scope.worktreeId] = [seededThread()];
  const user = userEvent.setup();
  renderComments(store);

  await user.click(await screen.findByRole('button', { name: '1 comment' }));
  expect(screen.getByText('Agent')).toBeTruthy();
  expect(screen.getByText('Agent context for this file')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Reply' }));
  await user.type(screen.getByLabelText('Reply'), 'Reviewer follow-up');
  await user.click(screen.getByRole('button', { name: 'Post reply' }));
  await screen.findByText('Reviewer follow-up');
  expect(store.comments[scope.worktreeId]?.[0]?.messages).toEqual([
    expect.objectContaining({ author: 'agent' }),
    expect.objectContaining({ author: 'reviewer', body: 'Reviewer follow-up' }),
  ]);

  await user.click(screen.getByRole('button', { name: 'Resolve comment' }));
  await screen.findByText('Resolved');
  await user.click(screen.getByRole('button', { name: 'Unresolve comment' }));
  await waitFor(() => expect(screen.queryByText('Resolved')).toBeNull());
});

it('preserves a failed reply draft and leaves resolution unchanged', async () => {
  const store = createMockStore();
  store.comments[scope.worktreeId] = [seededThread()];
  const user = userEvent.setup();
  renderComments(store);

  await user.click(await screen.findByRole('button', { name: '1 comment' }));
  await user.click(screen.getByRole('button', { name: 'Reply' }));
  await user.type(screen.getByLabelText('Reply'), 'Retry this reply');
  store.commentsFailed = true;
  await user.click(screen.getByRole('button', { name: 'Post reply' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Comments are unavailable',
  );
  expect(screen.getByLabelText('Reply')).toHaveProperty(
    'value',
    'Retry this reply',
  );
  await user.click(screen.getByRole('button', { name: 'Resolve comment' }));
  expect((await screen.findAllByRole('alert')).at(-1)?.textContent).toContain(
    'Comments are unavailable',
  );
  expect(store.comments[scope.worktreeId]?.[0]?.resolved).toBe(false);
});

it('keeps comment counts and cache updates isolated by worktree', async () => {
  const store = createMockStore();
  store.comments[scope.worktreeId] = [seededThread()];
  const user = userEvent.setup();
  renderComments(
    store,
    <>
      <FileComments scope={scope} path="src/components/review-panel.tsx" />
      <FileComments scope={otherScope} path="src/components/review-panel.tsx" />
    </>,
  );

  expect(await screen.findByRole('button', { name: '1 comment' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '0 comments' })).toBeTruthy();
  const commentButtons = screen.getAllByRole('button', { name: '1 comment' });
  const firstCommentButton = commentButtons[0];
  if (!firstCommentButton) throw new Error('Missing first comment button');
  await user.click(firstCommentButton);
  await user.click(screen.getByRole('button', { name: 'Reply' }));
  await user.type(screen.getByLabelText('Reply'), 'Only the first worktree');
  await user.click(screen.getByRole('button', { name: 'Post reply' }));
  await screen.findByText('Only the first worktree');
  expect(screen.getByRole('button', { name: '0 comments' })).toBeTruthy();
  expect(store.comments[otherScope.worktreeId]).toBeUndefined();
});

it('does not show revisionless range comments without comparison identity', async () => {
  const store = createMockStore();
  store.comments[scope.worktreeId] = [
    seededThread(),
    {
      ...seededThread(),
      id: '00000000-0000-4000-8000-000000000003',
      anchor: {
        kind: 'codeRange',
        filePath: 'src/components/review-panel.tsx',
        startLine: 3,
        endLine: 4,
      },
      messages: [
        {
          id: '00000000-0000-4000-8000-000000000004',
          body: 'Ambiguous range comment',
          author: 'agent',
        },
      ],
    },
  ];
  const user = userEvent.setup();
  renderComments(store);

  await user.click(await screen.findByRole('button', { name: '1 comment' }));
  expect(screen.getByText('Agent context for this file')).toBeTruthy();
  expect(screen.queryByText('Ambiguous range comment')).toBeNull();
});
