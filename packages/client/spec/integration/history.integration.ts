import type { InfiniteData } from '@tanstack/query-core';
import type { ListCommitsResponse } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/query-core';
import { test } from '@porcelain/server/kit/server-test';
import { threeCommits } from '@porcelain/server/kit/reads';
import { historyQueryOptions } from '@porcelain/client/history';
import { commitQueryOptions } from '@porcelain/client/history';
import { readCommitDiffs } from '@porcelain/client/changes';
import { connection } from '../kit/connection.ts';

test('read commit metadata, renamed paths and the selected commit patch', async ({
  server,
  session,
}) => {
  const state = await threeCommits(session);
  const {
    connected,
    scope,
    read: nativeRead,
  } = await connection(server, session);
  const cache = new QueryClient();
  const history = await cache.infiniteQuery(
    historyQueryOptions(scope, connected),
  );
  expect(history.commits.map((commit) => commit.subject)).toEqual([
    'Rename',
    'Second commit',
    'Initial commit',
  ]);
  const commit = await cache.query(
    commitQueryOptions(scope, connected, state.second),
  );
  expect(commit).toMatchObject({
    commit: {
      oid: state.second,
      subject: 'Second commit',
      body: 'With a body',
    },
  });
  const diffs = await nativeRead(
    readCommitDiffs({
      scope,
      connection: connected,
      oid: state.second,
      parent: 1,
      paths: [[session.fixture.readme.path]],
    }),
  );
  expect(diffs).toEqual({
    commitOid: state.second,
    diffs: [
      {
        paths: [session.fixture.readme.path],
        content: {
          kind: 'text',
          patch: await session.git(
            'diff',
            state.initial,
            state.second,
            '--',
            session.fixture.readme.path,
          ),
        },
      },
    ],
  });
  const renamed = await cache.query(
    commitQueryOptions(scope, connected, state.rename),
  );
  expect(renamed.files).toEqual([
    expect.objectContaining({
      status: 'renamed',
      oldPath: session.fixture.readme.path,
      newPath: 'GUIDE.md',
    }),
  ]);
});

test('read root, deleted, binary and empty commit changes without inventing a parent or a surviving path', async ({
  server,
  session,
}) => {
  const {
    connected,
    scope,
    read: nativeRead,
  } = await connection(server, session);
  const cache = new QueryClient();
  const rootOid = (
    await session.git('rev-list', '--max-parents=0', 'HEAD')
  ).trim();
  const root = await cache.query(commitQueryOptions(scope, connected, rootOid));
  expect(root.comparison).toEqual({ kind: 'empty-tree' });
  expect(root.files).toContainEqual({
    oldPath: undefined,
    newPath: session.fixture.readme.path,
    status: 'added',
    oldMode: '000000',
    newMode: '100644',
  });
  const rootDiff = await nativeRead(
    readCommitDiffs({
      scope,
      connection: connected,
      oid: rootOid,
      parent: 1,
      paths: [[session.fixture.readme.path]],
    }),
  );
  expect(rootDiff).toEqual({
    commitOid: rootOid,
    diffs: [
      {
        paths: [session.fixture.readme.path],
        content: {
          kind: 'text',
          patch: await session.git(
            'show',
            '--format=',
            rootOid,
            '--',
            session.fixture.readme.path,
          ),
        },
      },
    ],
  });
  await session.git('reset', '--hard', rootOid);
  await session.remove(session.fixture.readme.path);
  await session.writeFile('image.bin', new Uint8Array([0, 1, 2, 3]));
  await session.git('add', '-A');
  await session.git('commit', '-m', 'Delete readme and add binary');
  const oid = (await session.git('rev-parse', 'HEAD')).trim();
  const changed = await cache.query(commitQueryOptions(scope, connected, oid));
  expect(changed.files).toEqual([
    {
      oldPath: session.fixture.readme.path,
      newPath: undefined,
      status: 'deleted',
      oldMode: '100644',
      newMode: '000000',
    },
    {
      oldPath: undefined,
      newPath: 'image.bin',
      status: 'added',
      oldMode: '000000',
      newMode: '100644',
    },
  ]);
  const diffs = await nativeRead(
    readCommitDiffs({
      scope,
      connection: connected,
      oid,
      parent: 1,
      paths: [[session.fixture.readme.path], ['image.bin']],
    }),
  );
  expect(diffs).toEqual({
    commitOid: oid,
    diffs: [
      {
        paths: [session.fixture.readme.path],
        content: {
          kind: 'text',
          patch: await session.git(
            'diff',
            `${oid}^`,
            oid,
            '--',
            session.fixture.readme.path,
          ),
        },
      },
      { paths: ['image.bin'], content: { kind: 'binary' } },
    ],
  });
  await session.git('commit', '--allow-empty', '-m', 'Empty commit');
  const emptyOid = (await session.git('rev-parse', 'HEAD')).trim();
  const empty = await cache.query(
    commitQueryOptions(scope, connected, emptyOid),
  );
  expect(empty.commit.subject).toBe('Empty commit');
  expect(empty.files).toEqual([]);
  cache.clear();
});

test('compare a merge with the chosen parent and cache each parent independently', async ({
  server,
  session,
}) => {
  await session.git('reset', '--hard', 'HEAD');
  await session.git('checkout', '-b', 'topic');
  await session.writeFile('TOPIC.md', 'topic change\n');
  await session.git('add', 'TOPIC.md');
  await session.git('commit', '-m', 'Topic change');
  const topic = (await session.git('rev-parse', 'HEAD')).trim();
  await session.git('checkout', session.fixture.branch);
  await session.writeFile('MAIN.md', 'main change\n');
  await session.git('add', 'MAIN.md');
  await session.git('commit', '-m', 'Main change');
  const main = (await session.git('rev-parse', 'HEAD')).trim();
  await session.git('merge', '--no-ff', 'topic', '-m', 'Merge topic');
  const oid = (await session.git('rev-parse', 'HEAD')).trim();
  const {
    connected,
    scope,
    read: nativeRead,
  } = await connection(server, session);
  const cache = new QueryClient();
  const first = await cache.query(commitQueryOptions(scope, connected, oid, 1));
  const second = await cache.query(
    commitQueryOptions(scope, connected, oid, 2),
  );
  expect(first.commit.parentOids).toEqual([main, topic]);
  expect(first.comparison).toEqual({
    kind: 'parent',
    parentNumber: 1,
    baseOid: main,
  });
  expect(first.files.map((file) => file.newPath)).toEqual(['TOPIC.md']);
  expect(second.comparison).toEqual({
    kind: 'parent',
    parentNumber: 2,
    baseOid: topic,
  });
  expect(second.files.map((file) => file.newPath)).toEqual(['MAIN.md']);
  const diff = await nativeRead(
    readCommitDiffs({
      scope,
      connection: connected,
      oid,
      parent: 2,
      paths: [['MAIN.md']],
    }),
  );
  expect(diff).toEqual({
    commitOid: oid,
    diffs: [
      {
        paths: ['MAIN.md'],
        content: {
          kind: 'text',
          patch: await session.git('diff', topic, oid, '--', 'MAIN.md'),
        },
      },
    ],
  });
  expect(
    cache.getQueryData(commitQueryOptions(scope, connected, oid, 1).queryKey),
  ).toEqual(first);
  cache.clear();
});

test('continue history with its tip and frontier and discard earlier pages after a restart', async ({
  server,
  session,
}) => {
  await session.git('checkout', '--orphan', 'paginated');
  await session.git('commit', '-am', 'History root');
  for (let index = 0; index < 50; index += 1)
    await session.git('commit', '--allow-empty', '-m', `Commit ${index}`);
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  const observer = new InfiniteQueryObserver(
    cache,
    historyQueryOptions(scope, connected),
  );
  const first = await observer.refetch();
  expect(first.data?.commits).toHaveLength(50);
  expect(observer.getCurrentResult().hasNextPage).toBe(true);
  const next = await observer.fetchNextPage();
  expect(next.data?.commits).toHaveLength(51);
  expect(next.data?.commits.at(-1)?.subject).toBe('History root');
  expect(next.hasNextPage).toBe(false);
  const options = historyQueryOptions(scope, connected);
  const original = cache.getQueryData<InfiniteData<ListCommitsResponse>>(
    options.queryKey,
  );
  if (!original?.pages[0]) throw new Error('Expected history pages');
  await session.git('checkout', '--orphan', 'replacement');
  await session.git('commit', '-am', 'Replacement history');
  const restarted = await options.queryFn({
    signal: new AbortController().signal,
    pageParam: options.getNextPageParam(original.pages[0]),
  });
  expect(restarted.restarted).toBe(true);
  expect(
    options
      .select({
        pages: [...original.pages, restarted],
        pageParams: [undefined, undefined, undefined],
      })
      .commits.map((commit) => commit.subject),
  ).toEqual(['Replacement history']);
  observer.destroy();
});
