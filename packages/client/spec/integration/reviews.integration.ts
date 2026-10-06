import { runClientRequest } from '@porcelain/client/transport';
import { commentCommands, reviewedCommands } from '@porcelain/client/reviews';
import { expect } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { test } from '@porcelain/server/kit/server-test';
import {
  read,
  sampleReview,
  worktreePath,
} from '@porcelain/server/kit/requests';
import { readPublishedReview } from '@porcelain/client/reviews';
import { commentsQueryOptions } from '@porcelain/client/reviews';
import {
  reviewedQueryOptions,
  readLayerMarks,
} from '@porcelain/client/reviews';
import { readChanges } from '@porcelain/client/changes';
import { readChangeDiffs } from '@porcelain/client/changes';
import { connection } from '../kit/connection.ts';

test('read an unpublished review, then its published layers and discussion', async ({
  server,
  session,
}) => {
  const {
    connected,
    scope,
    read: nativeRead,
    registry,
  } = await connection(server, session);
  const cache = new QueryClient();
  expect(
    await nativeRead(readPublishedReview({ scope, connection: connected })),
  ).toBeNull();
  const layerId = '75dc6a36-a001-4d00-b511-c45430b99403';
  await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(
      session,
      0,
      layerId,
      '75dc6a36-a001-4d00-b511-c45430b99404',
    ),
  });
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      anchor: { kind: 'file', filePath: session.fixture.readme.path },
      body: 'Please explain this line.',
    },
  });
  const published = readPublishedReview({ scope, connection: connected });
  registry.refresh(published);
  const review = await nativeRead(published);
  expect(review).toMatchObject({
    worktreeId: scope.worktreeId,
    environmentId: connected.environmentId,
    revision: 1,
    active: true,
    layers: [{ id: layerId, title: 'Readme', summary: 'Adds a line' }],
  });
  expect(review?.summary.token).toMatch(/^[0-9a-f-]{36}$/);
  const threads = await cache.query(commentsQueryOptions(scope, connected));
  expect(threads).toHaveLength(1);
  expect(threads[0]?.messages[0]?.body).toBe('Please explain this line.');
  expect(
    await cache.query(reviewedQueryOptions(scope, connected)),
  ).toMatchObject({ worktreeId: scope.worktreeId, marks: [] });
  expect(
    await nativeRead(readLayerMarks({ scope, connection: connected })),
  ).toEqual({
    worktreeId: scope.worktreeId,
    marks: [],
  });
});

test('read changes and the exact Git patch, and refuse a stale diff snapshot', async ({
  server,
  session,
}) => {
  const {
    connected,
    scope,
    read: nativeRead,
  } = await connection(server, session);
  const changes = await nativeRead(
    readChanges({ scope, connection: connected }),
  );
  expect(changes.changes).toHaveLength(1);
  const file = changes.changes[0];
  if (!file) throw new Error('Expected the changed readme');
  expect(file.path).toBe(session.fixture.readme.path);
  const input = {
    expectedStatusToken: changes.statusToken,
    expectedFiles: [{ path: file.path, fingerprint: file.fingerprint }],
    selections: [
      { scope: 'unstaged' as const, oldPath: file.path, newPath: file.path },
    ],
  };
  const diffs = await nativeRead(
    readChangeDiffs({ scope, connection: connected, input }),
  );
  expect(diffs.diffs).toEqual([
    {
      selection: input.selections[0],
      content: {
        kind: 'text',
        patch: await session.git('diff', '--', file.path),
      },
    },
  ]);
  await session.writeFile(file.path, 'A newer change\n');
  await expect(
    nativeRead(readChangeDiffs({ scope, connection: connected, input })),
  ).rejects.toMatchObject({
    _tag: 'WorktreeChangedError',
    message: 'Worktree changed during inspection',
  });
});

test('write the discussion through the shared owner and read each persisted edit', async ({
  server,
  session,
}) => {
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  const commands = commentCommands(scope, connected, cache);
  const created = await runClientRequest(
    commands.create({
      anchor: { kind: 'change' },
      body: 'Explain the change.',
    }),
    connected.request().signal,
    connected.runtime,
  );
  const thread = created[0];
  if (!thread) throw new Error('Expected the created discussion');
  expect(thread.messages.map((message) => message.body)).toEqual([
    'Explain the change.',
  ]);
  const replied = await runClientRequest(
    commands.reply({
      threadId: thread.id,
      body: 'Please include its test.',
      messageId: 'eb90812a-6a3e-464e-92ca-5c962094b867',
    }),
    connected.request().signal,
    connected.runtime,
  );
  expect(replied[0]?.messages.map((message) => message.body)).toEqual([
    'Explain the change.',
    'Please include its test.',
  ]);
  await runClientRequest(
    commands.edit({
      threadId: thread.id,
      messageId: 'eb90812a-6a3e-464e-92ca-5c962094b867',
      body: 'Include the regression test.',
    }),
    connected.request().signal,
    connected.runtime,
  );
  const resolved = await runClientRequest(
    commands.resolve({
      threadId: thread.id,
      resolved: true,
    }),
    connected.request().signal,
    connected.runtime,
  );
  expect(resolved[0]?.resolved).toBe(true);
  expect(
    (await cache.query(commentsQueryOptions(scope, connected)))
      .find((entry) => entry.id === thread.id)
      ?.messages.map((message) => message.body),
  ).toEqual(['Explain the change.', 'Include the regression test.']);
  const revision = resolved[0]?.revision;
  if (revision === undefined)
    throw new Error('Expected the confirmed thread revision');
  expect(
    (
      await runClientRequest(
        commands.removeResolved([{ threadId: thread.id, revision }]),
        connected.request().signal,
        connected.runtime,
      )
    ).deleted,
  ).toEqual([thread.id]);
  expect(
    (await cache.query(commentsQueryOptions(scope, connected))).some(
      (entry) => entry.id === thread.id,
    ),
  ).toBe(false);
});

test('mark and unmark the actual changed file through the shared reviewed owner', async ({
  server,
  session,
}) => {
  const {
    connected,
    scope,
    read: nativeRead,
  } = await connection(server, session);
  const cache = new QueryClient();
  const changes = await nativeRead(
    readChanges({ scope, connection: connected }),
  );
  const file = changes.changes[0];
  if (!file?.fingerprint)
    throw new Error('Expected the changed file fingerprint');
  const commands = reviewedCommands(
    scope,
    connected,
    cache,
    { kind: 'worktree' },
    { now: () => '2026-10-03T10:00:00.000Z' },
  );
  await cache.query(reviewedQueryOptions(scope, connected));
  expect(
    (
      await runClientRequest(
        commands.set({ path: file.path, fingerprint: file.fingerprint }),
        connected.request().signal,
        connected.runtime,
      )
    ).marks.map((mark) => mark.path),
  ).toEqual([session.fixture.readme.path]);
  expect(
    (await cache.query(reviewedQueryOptions(scope, connected))).marks.map(
      (mark) => mark.path,
    ),
  ).toEqual([session.fixture.readme.path]);
  expect(
    (
      await runClientRequest(
        commands.remove(file.path),
        connected.request().signal,
        connected.runtime,
      )
    ).marks,
  ).toEqual([]);
  expect(
    (await cache.query(reviewedQueryOptions(scope, connected))).marks,
  ).toEqual([]);
});
