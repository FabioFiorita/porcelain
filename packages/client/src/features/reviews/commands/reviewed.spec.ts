import { afterEach } from 'vitest';
import { ManagedRuntime } from 'effect';
import { WriteQueues } from '@porcelain/client/transport';
import { runClientRequest } from '@porcelain/client/transport';
import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { reviewedCommands } from './reviewed.ts';
import { reviewedQueryOptions } from '@porcelain/client/reviews';
import { REVIEWED_FILE_MARKS } from '@porcelain/contracts/shared';
import { Schema } from 'effect';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const fingerprint = 'a'.repeat(64);

describe('reviewed writes keep confirmed marks', () => {
  it('rolls back every pending mark after a failure and never sends the dependent write', async () => {
    const requestRuntime = runtimeFixture();

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
    const first = runClientRequest(
      commands.set({ path: 'first.md', fingerprint }),
      connection.request().signal,
      requestRuntime,
    );
    const second = runClientRequest(
      commands.set({ path: 'second.md', fingerprint }),
      connection.request().signal,
      requestRuntime,
    );
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
    const requestRuntime = runtimeFixture();

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
      runClientRequest(
        reviewedCommands(
          scope,
          connection,
          client,
          { kind: 'worktree' },
          { now: () => '2026-10-03T10:00:00.000Z' },
        ).set({ path: 'first.md', fingerprint }),
        connection.request().signal,
        requestRuntime,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(client.getQueryData(key)).toBeUndefined();
  });
});

function bulkConnection(
  answer: (
    files: readonly { path: string; fingerprint: string }[],
    number: number,
  ) => Response,
) {
  const requests: {
    path: string;
    files: readonly { path: string; fingerprint: string }[];
  }[] = [];
  return {
    requests,
    environmentId: 'environment',
    request: () => ({ signal: new AbortController().signal }),
    transport: (path: string, init?: RequestInit) => {
      const body = init?.body;
      if (!(body instanceof Uint8Array))
        throw new Error('Expected request bytes');
      const parsed = Schema.decodeUnknownSync(
        Schema.fromJsonString(
          Schema.Struct({
            files: Schema.Array(
              Schema.Struct({
                path: Schema.String,
                fingerprint: Schema.String,
              }),
            ),
          }),
        ),
      )(new TextDecoder().decode(body));
      requests.push({ path, files: parsed.files });
      return Promise.resolve(answer(parsed.files, requests.length));
    },
  };
}
it('chunks bulk marks at the wire limit and reports partial conflicts without losing later marks', async () => {
  const requestRuntime = runtimeFixture();

  const connection = bulkConnection((files, number) =>
    Response.json({
      worktreeId: scope.worktreeId,
      marks: [],
      marked: files
        .filter((file) => file.path !== 'file-1')
        .map((file) => file.path),
      conflicts: number === 1 ? [{ path: 'file-1', reason: 'stale' }] : [],
    }),
  );
  const commands = reviewedCommands(
    scope,
    connection,
    new QueryClient(),
    { kind: 'worktree' },
    { now: () => '2026-10-05T04:00:00.000Z' },
  );
  const report = await runClientRequest(
    commands.markAll(
      Array.from({ length: REVIEWED_FILE_MARKS + 1 }, (_, number) => ({
        path: `file-${number}`,
        fingerprint,
        reviewStatus: 'unreviewed' as const,
      })),
    ),
    connection.request().signal,
    requestRuntime,
  );
  expect(connection.requests.map((request) => request.files.length)).toEqual([
    2000, 1,
  ]);
  expect(connection.requests[1]?.files).toEqual([
    { path: 'file-2000', fingerprint },
  ]);
  expect(report.marked.length).toBe(2000);
  expect(report.failed).toEqual([
    {
      path: 'file-1',
      error: new Error('The file changed since it was shown.'),
    },
  ]);
  expect(report.skipped).toEqual([]);
});
it('stops a bulk operation after its first refused chunk', async () => {
  const requestRuntime = runtimeFixture();

  const connection = bulkConnection(() =>
    Response.json(
      { statusCode: 403, error: 'Forbidden', message: 'Review refused' },
      { status: 403 },
    ),
  );
  const commands = reviewedCommands(
    scope,
    connection,
    new QueryClient(),
    { kind: 'worktree' },
    { now: () => '2026-10-05T04:00:00.000Z' },
  );
  await expect(
    runClientRequest(
      commands.markAll(
        Array.from({ length: REVIEWED_FILE_MARKS + 1 }, (_, number) => ({
          path: `file-${number}`,
          fingerprint,
          reviewStatus: 'unreviewed' as const,
        })),
      ),
      connection.request().signal,
      requestRuntime,
    ),
  ).rejects.toMatchObject({ message: 'Review refused', status: 403 });
  expect(connection.requests.map((request) => request.files.length)).toEqual([
    2000,
  ]);
});
it('uses the selected branch when reading and removing marks', async () => {
  const requestRuntime = runtimeFixture();

  const requests: { path: string; body: unknown }[] = [];
  const signal = new AbortController().signal;
  const connection = {
    environmentId: 'environment',
    request: () => ({ signal }),
    transport: (path: string, init?: RequestInit) => {
      const bytes = init?.body;
      requests.push({
        path,
        body:
          bytes instanceof Uint8Array
            ? JSON.parse(new TextDecoder().decode(bytes))
            : null,
      });
      return Promise.resolve(
        Response.json({ worktreeId: scope.worktreeId, marks: [] }),
      );
    },
  };
  const range = {
    kind: 'branch' as const,
    base: 'refs/heads/main',
    branch: 'refs/heads/topic',
  };
  await reviewedQueryOptions(scope, connection, range).queryFn({ signal });
  const commands = reviewedCommands(
    scope,
    connection,
    new QueryClient(),
    range,
    { now: () => '2026-10-05T04:00:00.000Z' },
  );
  await runClientRequest(
    commands.remove('README.md'),
    connection.request().signal,
    requestRuntime,
  );
  await runClientRequest(
    commands.removeAll(['README.md']),
    connection.request().signal,
    requestRuntime,
  );
  expect(requests).toEqual([
    {
      path: `/api/worktrees/${scope.worktreeId}/reviewed?scope=branch&branch=refs%2Fheads%2Ftopic`,
      body: null,
    },
    {
      path: `/api/worktrees/${scope.worktreeId}/reviewed?path=README.md&scope=branch&branch=refs%2Fheads%2Ftopic`,
      body: null,
    },
    {
      path: `/api/worktrees/${scope.worktreeId}/reviewed-bulk`,
      body: {
        paths: ['README.md'],
        scope: 'branch',
        branch: 'refs/heads/topic',
      },
    },
  ]);
});

const runtimes = new Set<ManagedRuntime.ManagedRuntime<WriteQueues, never>>();
function runtimeFixture() {
  const runtime = ManagedRuntime.make(WriteQueues.layer);
  runtimes.add(runtime);
  return runtime;
}
afterEach(async () => {
  for (const runtime of runtimes) await runtime.dispose();
  runtimes.clear();
});
