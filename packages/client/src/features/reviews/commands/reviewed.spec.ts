import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { reviewedCommands } from './reviewed.ts';
import { reviewedQueryOptions } from '@porcelain/client/reviews';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const fingerprint = 'a'.repeat(64);

describe('reviewed writes keep confirmed marks', () => {
  it('rolls back every pending mark after a failure and never sends the dependent write', async () => {
    const paths: string[] = [];
    const connection = {
      environmentId: 'environment',
      request: (signal?: AbortSignal) => ({
        signal: signal ?? new AbortController().signal,
      }),
      transport: (path: string) => {
        paths.push(path);
        return Promise.resolve(
          Response.json({ message: 'File changed' }, { status: 409 }),
        );
      },
    };
    const client = new QueryClient();
    const key = reviewedQueryOptions(scope, connection).queryKey;
    const confirmed = {
      worktreeId: scope.worktreeId,
      marks: [
        {
          path: 'kept.md',
          fingerprint,
          reviewedAt: '2026-10-03T10:00:00.000Z',
        },
      ],
    };
    client.setQueryData(key, confirmed);
    const commands = reviewedCommands(
      scope,
      connection,
      client,
      { kind: 'worktree' },
      { now: () => '2026-10-03T10:00:00.000Z' },
    );
    const first = commands.set({ path: 'first.md', fingerprint });
    const second = commands.set({ path: 'second.md', fingerprint });
    const results = await Promise.allSettled([first, second]);
    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(paths).toEqual([
      '/api/worktrees/00000000000000000000000000000000/reviewed',
    ]);
    expect(client.getQueryData(key)).toEqual(confirmed);
  });

  it('refuses to publish an answer completed after disconnect', async () => {
    const controller = new AbortController();
    const connection = {
      environmentId: 'environment',
      request: (signal?: AbortSignal) => ({
        signal: signal
          ? AbortSignal.any([controller.signal, signal])
          : controller.signal,
      }),
      transport: () => {
        controller.abort();
        client.clear();
        return Promise.resolve(
          Response.json({
            worktreeId: scope.worktreeId,
            marks: [
              {
                path: 'first.md',
                fingerprint,
                reviewedAt: '2026-10-03T10:00:00.000Z',
              },
            ],
          }),
        );
      },
    };
    const client = new QueryClient();
    const key = reviewedQueryOptions(scope, connection).queryKey;
    client.setQueryData(key, { worktreeId: scope.worktreeId, marks: [] });
    await expect(
      reviewedCommands(
        scope,
        connection,
        client,
        { kind: 'worktree' },
        { now: () => '2026-10-03T10:00:00.000Z' },
      ).set({ path: 'first.md', fingerprint }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(client.getQueryData(key)).toBeUndefined();
  });
});
