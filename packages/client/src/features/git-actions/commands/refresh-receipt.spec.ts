import { Reactivity } from 'effect/reactivity';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
import { Effect, Fiber } from 'effect';
import { expect, it } from 'vitest';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import { queryKeys } from '@porcelain/client/transport';
import { refreshGitReceipt } from './refresh-receipt.ts';

const receipt: RunGitActionResponse = {
  projectId: '11111111-1111-4111-8111-111111111111',
  worktreeId: '0123456789abcdef0123456789abcdef',
  requestId: '22222222-2222-4222-8222-222222222222',
  action: 'fetch',
  state: 'succeeded',
  acceptedAt: '2026-10-05T10:00:00.000Z',
  progress: [],
};

it('coalesces a live receipt with its command, keeps refreshing when one waiter closes, and permits a later fresh read', async () => {
  const client = new QueryClient();
  const started = Promise.withResolvers<void>();
  const answer = Promise.withResolvers<string>();
  const key = queryKeys.worktreeSurface(
    {
      environmentId: 'environment',
      transport: () => Promise.resolve(new Response()),
      request: () => ({ signal: new AbortController().signal }),
    },
    receipt,
    ['changes'],
  );
  client.setQueryData(key, 'before');
  let reads = 0;
  const unsubscribe = new QueryObserver(client, {
    queryKey: key,
    staleTime: Infinity,
    queryFn: () => {
      reads += 1;
      started.resolve();
      return answer.promise;
    },
  }).subscribe(() => {});
  try {
    const reactivity = Effect.runSync(Reactivity.make);
    const command = Effect.runFork(
      refreshGitReceipt(client, 'environment', receipt).pipe(
        Effect.provideService(Reactivity.Reactivity, reactivity),
      ),
    );
    await started.promise;
    const notice = Effect.runFork(
      refreshGitReceipt(client, 'environment', receipt).pipe(
        Effect.provideService(Reactivity.Reactivity, reactivity),
      ),
    );
    await Effect.runPromise(Fiber.interrupt(command));
    expect(reads).toBe(1);
    expect(client.getQueryData(key)).toBe('before');
    answer.resolve('after');
    await Effect.runPromise(Fiber.join(notice));
    expect(client.getQueryData(key)).toBe('after');
    await Effect.runPromise(
      refreshGitReceipt(client, 'environment', receipt).pipe(
        Effect.provideService(Reactivity.Reactivity, reactivity),
      ),
    );
    expect(reads).toBe(2);
  } finally {
    answer.resolve('cleanup');
    unsubscribe();
    client.clear();
  }
});

it.each(['running', 'rejected', 'no-change'] as const)(
  'keeps confirmed caches intact for a %s receipt',
  async (state) => {
    const client = new QueryClient();
    const key = queryKeys.inventory('environment');
    client.setQueryData(key, 'confirmed');
    try {
      await Effect.runPromise(
        refreshGitReceipt(client, 'environment', { ...receipt, state }).pipe(
          Effect.provide(Reactivity.layer),
        ),
      );
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
      expect(client.getQueryData(key)).toBe('confirmed');
    } finally {
      client.clear();
    }
  },
);
