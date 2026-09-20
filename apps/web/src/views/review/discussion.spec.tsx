import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { createMockStore, mockEnvironmentId } from '../../api/inventory/mock';
import { createMockApi } from '../../api/mock-api';
import type { CommentThread } from '../../domain/comments';
import { createQueryClient } from '../../query/client';
import { useComments } from '../../query/comments';
import {
  useWorkspaceContext,
  WorkspaceProvider,
} from '../../query/workspace-provider';
import { ThreadCard } from './thread-card';

function Discussion({
  scope,
}: {
  scope: { projectId: string; worktreeId: string };
}) {
  const { threads } = useComments(scope);
  return (
    <section aria-label={scope.worktreeId}>
      {threads.map((thread) => (
        <ThreadCard key={thread.id} scope={scope} thread={thread} />
      ))}
    </section>
  );
}

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

async function renderComments(
  store = createMockStore(),
  children: ReactNode = <Discussion scope={scope} />,
) {
  const queryClient = createQueryClient();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={createMockApi(store)}>
        <ConnectionGate>{children}</ConnectionGate>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  return { store, queryClient, screen };
}

it('shows author identity, replies to a thread, and toggles resolution accessibly', async () => {
  const store = createMockStore();
  store.comments[scope.worktreeId] = [seededThread()];
  const { screen } = await renderComments(store);

  await expect
    .element(screen.getByText('Agent context for this file'))
    .toBeVisible();
  expect(screen.getByText('Agent').length).toBeGreaterThan(0);
  await expect
    .element(screen.getByText('Agent context for this file'))
    .toBeVisible();

  await screen.getByRole('button', { name: 'Reply' }).click();
  await screen.getByLabelText('Reply').fill('Reviewer follow-up');
  await screen.getByRole('button', { name: 'Post reply' }).click();
  await expect.element(screen.getByText('Reviewer follow-up')).toBeVisible();
  expect(store.comments[scope.worktreeId]?.[0]?.messages).toEqual([
    expect.objectContaining({ author: 'agent' }),
    expect.objectContaining({ author: 'reviewer', body: 'Reviewer follow-up' }),
  ]);

  await screen.getByRole('button', { name: 'Resolve' }).click();
  await expect
    .element(screen.getByRole('button', { name: 'Reopen' }))
    .toBeVisible();
  await screen.getByRole('button', { name: 'Reopen' }).click();
  await expect
    .element(screen.getByRole('button', { name: 'Reopen' }))
    .not.toBeInTheDocument();
});

it('preserves a failed reply draft and leaves resolution unchanged', async () => {
  const store = createMockStore();
  store.comments[scope.worktreeId] = [seededThread()];
  const { screen } = await renderComments(store);

  await expect
    .element(screen.getByText('Agent context for this file'))
    .toBeVisible();
  await screen.getByRole('button', { name: 'Reply' }).click();
  await screen.getByLabelText('Reply').fill('Retry this reply');
  store.commentsFailed = true;
  await screen.getByRole('button', { name: 'Post reply' }).click();
  await expect
    .element(screen.getByRole('alert'))
    .toMatchTextContent('Comments are unavailable');
  await expect
    .element(screen.getByLabelText('Reply'))
    .toHaveValue('Retry this reply');
  await screen.getByRole('button', { name: 'Cancel' }).click();
  await screen.getByRole('button', { name: 'Resolve' }).click();
  await expect
    .element(screen.getByRole('alert').last())
    .toMatchTextContent('Comments are unavailable');
  expect(store.comments[scope.worktreeId]?.[0]?.resolved).toBe(false);
});

it('keeps comment counts and cache updates isolated by worktree', async () => {
  const store = createMockStore();
  store.comments[scope.worktreeId] = [seededThread()];
  const { screen } = await renderComments(
    store,
    <>
      <Discussion scope={scope} />
      <Discussion scope={otherScope} />
    </>,
  );

  await expect
    .element(screen.getByText('Agent context for this file'))
    .toBeVisible();
  await screen.getByRole('button', { name: 'Reply' }).click();
  await screen.getByLabelText('Reply').fill('Only the first worktree');
  await screen.getByRole('button', { name: 'Post reply' }).click();
  await expect
    .element(screen.getByText('Only the first worktree'))
    .toBeVisible();
  expect(
    (
      await screen
        .getByRole('region', { name: otherScope.worktreeId })
        .element()
    ).textContent,
  ).toBe('');
  expect(store.comments[otherScope.worktreeId]).toBeUndefined();
});
