import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { Api } from '../api/api';
import { createMockStore } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import type { CommentThread } from '../domain/comments';
import { createQueryClient } from './client';
import {
  useComments,
  useCreateComment,
  useReplyComment,
  useResolveComment,
} from './comments';
import { queryKeys } from './keys';
import {
  useConnectedContext,
  useWorkspaceContext,
  WorkspaceProvider,
} from './workspace-provider';

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

function thread(): CommentThread {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    worktreeId: scope.worktreeId,
    anchor: { kind: 'file', filePath: 'README.md' },
    resolved: false,
    messages: [
      {
        id: '00000000-0000-4000-8000-000000000002',
        body: 'Original feedback',
        author: 'agent',
      },
    ],
  };
}

function MutationHarness({
  operation,
}: {
  operation: 'create' | 'reply' | 'resolve';
}) {
  const queryClient = useQueryClient();
  const { connection } = useConnectedContext();
  const comments = useComments(scope);
  const create = useCreateComment(scope);
  const reply = useReplyComment(scope);
  const resolve = useResolveComment(scope);
  const key = queryKeys.comments(connection.environmentId, scope);
  const current = comments.threads[0];
  return (
    <>
      <button
        type="button"
        onClick={() =>
          void queryClient.refetchQueries({ queryKey: key, exact: true })
        }
      >
        Start old read
      </button>
      {operation === 'create' ? (
        <button
          type="button"
          onClick={() =>
            void create
              .submit({
                anchor: { kind: 'file', filePath: 'README.md' },
                body: 'Created comment',
              })
              .catch(() => undefined)
          }
        >
          Run mutation
        </button>
      ) : current ? (
        <button
          type="button"
          onClick={() =>
            void (
              operation === 'reply'
                ? reply.submit({ threadId: current.id, body: 'New reply' })
                : resolve.submit({ threadId: current.id, resolved: true })
            ).catch(() => undefined)
          }
        >
          Run mutation
        </button>
      ) : (
        <span>Waiting for thread</span>
      )}
    </>
  );
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function renderMutation(
  operation: 'create' | 'reply' | 'resolve',
  initial: CommentThread[],
) {
  const store = createMockStore();
  store.comments[scope.worktreeId] = structuredClone(initial);
  const baseApi = createMockApi(store);
  const oldRead = deferred<CommentThread[]>();
  let reads = 0;
  const api: Api = {
    ...baseApi,
    comments: {
      ...baseApi.comments,
      async list(_request) {
        reads += 1;
        if (reads === 1) return structuredClone(initial);
        return oldRead.promise;
      },
    },
  };
  const queryClient = createQueryClient();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider api={api}>
        <ConnectionGate>
          <MutationHarness operation={operation} />
        </ConnectionGate>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  return {
    queryClient,
    store,
    oldRead,
    screen,
    get reads() {
      return reads;
    },
  };
}

function expectMutationCache(
  cached: CommentThread[] | undefined,
  operation: 'create' | 'reply' | 'resolve',
) {
  if (operation === 'create')
    expect(
      cached?.some(
        (candidate) => candidate.messages[0]?.body === 'Created comment',
      ),
    ).toBe(true);
  else if (operation === 'reply')
    expect(cached?.[0]?.messages.at(-1)?.body).toBe('New reply');
  else expect(cached?.[0]?.resolved).toBe(true);
}

it.each(['create', 'reply', 'resolve'] as const)(
  'keeps the %s response when an older list read resolves afterward',
  async (operation) => {
    const initial = operation === 'create' ? [] : [thread()];
    const state = await renderMutation(operation, initial);
    const key = queryKeys.comments(state.store.inventory.environmentId, scope);

    await expect
      .element(state.screen.getByRole('button', { name: 'Run mutation' }))
      .toBeVisible();
    await state.screen.getByRole('button', { name: 'Start old read' }).click();
    await vi.waitFor(() => expect(state.reads).toBe(2));
    await state.screen.getByRole('button', { name: 'Run mutation' }).click();
    await vi.waitFor(() => {
      expectMutationCache(
        state.queryClient.getQueryData<CommentThread[]>(key),
        operation,
      );
    });

    state.oldRead.resolve(structuredClone(initial));
    await vi.waitFor(() =>
      expect(state.queryClient.getQueryState(key)?.fetchStatus).toBe('idle'),
    );
    expectMutationCache(
      state.queryClient.getQueryData<CommentThread[]>(key),
      operation,
    );
  },
);
