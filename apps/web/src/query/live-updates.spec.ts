import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { applyLiveNotice, liveSubscription } from './live-updates';

const environmentId = '00000000-0000-4000-8000-000000000001';
const projectId = '00000000-0000-4000-8000-000000000002';
const otherProjectId = '00000000-0000-4000-8000-000000000003';
const worktreeId = 'a'.repeat(32);
const otherWorktreeId = 'b'.repeat(32);
const scope = { projectId, worktreeId } satisfies ReviewScope;

function observe(
  client: QueryClient,
  queryKey: readonly unknown[],
  read: () => unknown,
) {
  client.setQueryData(queryKey, { seeded: true });
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: async () => read(),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  return unsubscribe;
}

it('invalidates mutable file surfaces and the sidebar without rereading commits or unrelated worktrees', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const reads = {
    changes: vi.fn(() => ({ changes: [] })),
    text: vi.fn(() => ({ text: 'new' })),
    inventory: vi.fn(() => ({ environmentId, projects: [] })),
    comments: vi.fn(() => []),
    commit: vi.fn(() => ({ files: [] })),
    other: vi.fn(() => ({ changes: [] })),
  };
  const subscriptions = [
    observe(
      client,
      queryKeys.reviewSurface(environmentId, scope, ['changes']),
      reads.changes,
    ),
    observe(
      client,
      queryKeys.reviewSurface(environmentId, scope, ['text', 'src/a.ts']),
      reads.text,
    ),
    observe(client, queryKeys.inventory(environmentId), reads.inventory),
    observe(client, queryKeys.comments(environmentId, scope), reads.comments),
    observe(
      client,
      queryKeys.reviewSurface(environmentId, scope, ['commit', 'abc', 1]),
      reads.commit,
    ),
    observe(
      client,
      queryKeys.reviewSurface(
        environmentId,
        { projectId: otherProjectId, worktreeId: otherWorktreeId },
        ['changes'],
      ),
      reads.other,
    ),
  ];
  await applyLiveNotice(client, environmentId, {
    type: 'worktree',
    projectId,
    worktreeId,
    change: 'files',
  });

  expect(reads.changes).toHaveBeenCalledOnce();
  expect(reads.text).toHaveBeenCalledOnce();
  expect(reads.inventory).toHaveBeenCalledOnce();
  expect(reads.comments).not.toHaveBeenCalled();
  expect(reads.commit).not.toHaveBeenCalled();
  expect(reads.other).not.toHaveBeenCalled();
  for (const unsubscribe of subscriptions) unsubscribe();
});

it('subscribes every inventory project and includes active ignored-file paths', () => {
  const client = new QueryClient();
  client.setQueryData(queryKeys.inventory(environmentId), {
    environmentId,
    projects: [{ id: projectId }, { id: otherProjectId }],
  });
  const unsubscribe = observe(
    client,
    queryKeys.reviewSurface(environmentId, scope, ['text', '.private/token']),
    () => ({ text: 'secret' }),
  );

  expect(liveSubscription(client, environmentId)).toEqual({
    type: 'subscribe',
    projects: [projectId, otherProjectId],
    worktrees: [{ projectId, worktreeId, paths: ['.private/token'] }],
  });
  unsubscribe();
});
