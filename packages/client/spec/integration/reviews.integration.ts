import { expect } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { test } from '@porcelain/server/kit/server-test';
import {
  read,
  sampleReview,
  worktreePath,
} from '@porcelain/server/kit/requests';
import { publishedReviewQueryOptions } from '@porcelain/client/reviews';
import { commentsQueryOptions } from '@porcelain/client/reviews';
import {
  reviewedQueryOptions,
  layerMarksQueryOptions,
} from '@porcelain/client/reviews';
import { changesQueryOptions } from '@porcelain/client/changes';
import { changeDiffsQueryOptions } from '@porcelain/client/changes';
import { connection } from '../kit/connection.ts';

test('read an unpublished review, then its published layers and discussion', async ({
  server,
  session,
}) => {
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  expect(
    await cache.query(publishedReviewQueryOptions(scope, connected)),
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
  const review = await cache.query(
    publishedReviewQueryOptions(scope, connected),
  );
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
  expect(await cache.query(layerMarksQueryOptions(scope, connected))).toEqual({
    worktreeId: scope.worktreeId,
    marks: [],
  });
});

test('read changes and the exact Git patch, and refuse a stale diff snapshot', async ({
  server,
  session,
}) => {
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  const { changes } = await cache.query(changesQueryOptions(scope, connected));
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
  const diffs = await cache.query(
    changeDiffsQueryOptions(scope, connected, input),
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
    cache.query(changeDiffsQueryOptions(scope, connected, input)),
  ).rejects.toMatchObject({ status: 409, code: 'worktree_changed' });
});
