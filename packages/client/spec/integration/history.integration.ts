import type { InfiniteData } from '@tanstack/query-core';
import type { ListCommitsResponse } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/query-core';
import { test } from '@porcelain/server/kit/server-test';
import { threeCommits } from '@porcelain/server/kit/reads';
import { historyQueryOptions } from '@porcelain/client/history';
import { commitQueryOptions } from '@porcelain/client/history';
import { commitDiffsQueryOptions } from '@porcelain/client/changes';
import { connection } from '../kit/connection.ts';

test('read commit metadata, renamed paths and the selected commit patch', async ({
  server,
  session,
}) => {
  const state = await threeCommits(session);
  const { connected, scope } = await connection(server, session);
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
  const diffs = await cache.query(
    commitDiffsQueryOptions(scope, connected, state.second, 1, [
      [session.fixture.readme.path],
    ]),
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
