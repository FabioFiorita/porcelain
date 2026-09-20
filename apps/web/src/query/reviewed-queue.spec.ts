import { QueryClient } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import type { ReviewedMarksResponse } from '../domain/review';
import { enqueueReviewed } from './reviewed-queue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

it('rolls back failed optimism while retaining newer intent', async () => {
  const client = new QueryClient();
  const context = {
    connection: { controller: new AbortController() },
    key: ['review', 'environment', 'project', 'worktree', 'reviewed'],
  };
  const first = deferred<ReviewedMarksResponse>();
  const second = deferred<ReviewedMarksResponse>();
  client.setQueryData(context.key, { worktreeId: 'worktree', marks: [] });
  try {
    const a = enqueueReviewed(
      context,
      client,
      { path: 'a', fingerprint: 'a' },
      () => first.promise,
    );
    const rejected = expect(a).rejects.toThrow('stale file');
    const b = enqueueReviewed(
      context,
      client,
      { path: 'b', fingerprint: 'b' },
      () => second.promise,
    );
    // Both marks are showing before either has been confirmed.
    await vi.waitFor(() =>
      expect(
        client
          .getQueryData<ReviewedMarksResponse>(context.key)
          ?.marks.map((mark) => mark.path),
      ).toEqual(['a', 'b']),
    );
    first.reject(new Error('stale file'));
    await rejected;
    expect(
      client
        .getQueryData<ReviewedMarksResponse>(context.key)
        ?.marks.map((mark) => mark.path),
    ).toEqual(['b']);
    second.resolve({
      worktreeId: 'worktree',
      marks: [
        { path: 'b', fingerprint: 'b', reviewedAt: '2026-09-14T00:00:00Z' },
      ],
    });
    await b;
    expect(
      client.getQueryData<ReviewedMarksResponse>(context.key)?.marks,
    ).toEqual((await second.promise).marks);
  } finally {
    client.clear();
  }
});

it('does not repopulate or cancel cache entries after disconnect and late settlement', async () => {
  const client = new QueryClient();
  const controller = new AbortController();
  const context = {
    connection: { controller },
    key: ['review', 'environment', 'project', 'worktree', 'reviewed'],
  };
  client.setQueryData(context.key, { worktreeId: 'worktree', marks: [] });
  const response = deferred<ReviewedMarksResponse>();
  const started = deferred<void>();
  const result = enqueueReviewed(
    context,
    client,
    { path: 'a', fingerprint: 'a' },
    () => {
      started.resolve();
      return response.promise;
    },
  );
  const rejected = expect(result).rejects.toThrow('disconnected');
  await started.promise;
  controller.abort();
  client.clear();
  const cancel = vi.spyOn(client, 'cancelQueries');
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  response.reject(new Error('disconnected'));
  await rejected;
  await Promise.resolve();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  expect(cancel).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  client.clear();
});
