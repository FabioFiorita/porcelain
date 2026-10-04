import { commentCommands, reviewedCommands } from '@porcelain/client/reviews';
import {
  reviewFilesQueryOptions,
  untrackedFileDiffQueryOptions,
} from '@porcelain/client/reviews';
import { expect } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
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
import {
  changesQueryOptions,
  fileDiffReadsQueryOptions,
  recoverChangedDiffs,
} from '@porcelain/client/changes';
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

test('a stale shared file read refreshes the observed snapshot once and reads the new Git patch', async ({
  server,
  session,
}) => {
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  const options = changesQueryOptions(scope, connected);
  const observer = new QueryObserver(cache, options);
  const unsubscribe = observer.subscribe(() => {});
  const path = session.fixture.readme.path;
  const original = await session.readFile(path);
  let refresh: Promise<void> | undefined;
  let recoveries = 0;
  try {
    const { changes } = await cache.query(options);
    await session.writeFile(path, 'Updated between the list and diff read.\n');
    const recover = (token: string) => {
      recoveries += 1;
      refresh = recoverChangedDiffs(scope, connected, cache, token);
    };
    const [stale] = fileDiffReadsQueryOptions(
      scope,
      connected,
      changes,
      path,
      recover,
    );
    if (!stale) throw new Error('Expected a tracked diff');
    await expect(cache.query(stale)).rejects.toMatchObject({
      status: 409,
      code: 'worktree_changed',
    });
    await refresh;
    const current = observer.getCurrentResult().data?.changes;
    expect(recoveries).toBe(1);
    expect(
      current?.changes.find((file) => file.path === path)?.fingerprint,
    ).not.toBe(changes.changes.find((file) => file.path === path)?.fingerprint);
    if (!current) throw new Error('Expected the refreshed snapshot');
    const [fresh] = fileDiffReadsQueryOptions(
      scope,
      connected,
      current,
      path,
      recover,
    );
    if (!fresh) throw new Error('Expected the refreshed diff');
    expect(fresh.queryKey).not.toEqual(stale.queryKey);
    expect(await cache.query(fresh)).toEqual([
      [
        `unstaged\n${path}\n${path}`,
        { kind: 'text', patch: await session.git('diff', '--', path) },
      ],
    ]);
    expect(recoveries).toBe(1);
  } finally {
    unsubscribe();
    cache.clear();
    await session.writeFile(path, original);
  }
});

test('mobile file reads preserve staged and unstaged patches, untracked text and fingerprint-aware marks', async ({
  server,
  session,
}) => {
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  const path = session.fixture.readme.path;
  const original = await session.readFile(path);
  const indexed = await session.git('show', `:${path}`);
  try {
    await session.git('add', '--', path);
    await session.writeFile(
      path,
      `${session.fixture.readme.changed}Mobile review line.\n`,
    );
    await session.writeFile('mobile-note.txt', 'Untracked native note.\n');
    const { changes } = await cache.query(
      changesQueryOptions(scope, connected),
    );
    const comparisons = fileDiffReadsQueryOptions(
      scope,
      connected,
      changes,
      path,
      () => {},
    );
    expect(comparisons).toHaveLength(1);
    const patches = await Promise.all(
      comparisons.map((options) => cache.query(options)),
    );
    expect(patches.flat().map(([key]) => key)).toEqual([
      `staged\n${path}\n${path}`,
      `unstaged\n${path}\n${path}`,
    ]);
    expect(patches[0]?.[0]?.[1]).toEqual({
      kind: 'text',
      patch: await session.git('diff', '--cached', '--', path),
    });
    expect(patches[0]?.[1]?.[1]).toEqual({
      kind: 'text',
      patch: await session.git('diff', '--', path),
    });
    expect(
      fileDiffReadsQueryOptions(
        scope,
        connected,
        changes,
        'mobile-note.txt',
        () => {},
      ),
    ).toEqual([]);
    const untracked = untrackedFileDiffQueryOptions(
      scope,
      connected,
      'mobile-note.txt',
    );
    expect(
      untracked.select(
        await cache.query({
          queryKey: untracked.queryKey,
          queryFn: untracked.queryFn,
        }),
      ),
    ).toEqual({ kind: 'text', patch: '+Untracked native note.\n' });
    const file = changes.changes.find((candidate) => candidate.path === path);
    if (!file?.fingerprint) throw new Error('Expected a reviewable readme');
    await reviewedCommands(
      scope,
      connected,
      cache,
      { kind: 'worktree' },
      { now: () => '2026-01-01T00:00:00Z' },
    ).set({ path, fingerprint: file.fingerprint });
    const marked = reviewFilesQueryOptions(
      scope,
      connected,
      { kind: 'worktree' },
      [{ path, fingerprint: file.fingerprint, note: 'staged, unstaged' }],
    );
    expect(
      marked.select(await cache.query(reviewedQueryOptions(scope, connected))),
    ).toEqual([
      {
        path,
        fingerprint: file.fingerprint,
        note: 'staged, unstaged',
        reviewed: 'Reviewed',
      },
    ]);
    await session.writeFile(path, 'Changed after reviewing.\n');
    const current = (
      await cache.query(changesQueryOptions(scope, connected))
    ).changes.changes.find((candidate) => candidate.path === path);
    if (!current) throw new Error('Expected the changed file');
    const stale = reviewFilesQueryOptions(
      scope,
      connected,
      { kind: 'worktree' },
      [{ path, fingerprint: current.fingerprint, note: 'unstaged' }],
    );
    expect(
      stale.select(await cache.query(reviewedQueryOptions(scope, connected)))[0]
        ?.reviewed,
    ).toBe('Changed since review');
    const first = comparisons[0];
    if (!first) throw new Error('Expected a tracked comparison');
    await expect(cache.query(first)).rejects.toMatchObject({
      status: 409,
      code: 'worktree_changed',
    });
  } finally {
    await session.writeFile(path, indexed);
    await session.git('add', '--', path);
    await session.writeFile(path, original);
    await session.remove('mobile-note.txt');
    await reviewedCommands(
      scope,
      connected,
      cache,
      { kind: 'worktree' },
      { now: () => '2026-01-01T00:00:00Z' },
    ).remove(path);
  }
});

test('write the discussion through the shared owner and read each persisted edit', async ({
  server,
  session,
}) => {
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  const commands = commentCommands(scope, connected, cache);
  const created = await commands.create({
    anchor: { kind: 'change' },
    body: 'Explain the change.',
  });
  const thread = created[0];
  if (!thread) throw new Error('Expected the created discussion');
  expect(thread.messages.map((message) => message.body)).toEqual([
    'Explain the change.',
  ]);
  const replied = await commands.reply({
    threadId: thread.id,
    body: 'Please include its test.',
    messageId: 'eb90812a-6a3e-464e-92ca-5c962094b867',
  });
  expect(replied[0]?.messages.map((message) => message.body)).toEqual([
    'Explain the change.',
    'Please include its test.',
  ]);
  await commands.edit({
    threadId: thread.id,
    messageId: 'eb90812a-6a3e-464e-92ca-5c962094b867',
    body: 'Include the regression test.',
  });
  const resolved = await commands.resolve({
    threadId: thread.id,
    resolved: true,
  });
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
    (await commands.removeResolved([{ threadId: thread.id, revision }]))
      .deleted,
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
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  const { changes } = await cache.query(changesQueryOptions(scope, connected));
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
      await commands.set({ path: file.path, fingerprint: file.fingerprint })
    ).marks.map((mark) => mark.path),
  ).toEqual([session.fixture.readme.path]);
  expect(
    (await cache.query(reviewedQueryOptions(scope, connected))).marks.map(
      (mark) => mark.path,
    ),
  ).toEqual([session.fixture.readme.path]);
  expect((await commands.remove(file.path)).marks).toEqual([]);
  expect(
    (await cache.query(reviewedQueryOptions(scope, connected))).marks,
  ).toEqual([]);
});
