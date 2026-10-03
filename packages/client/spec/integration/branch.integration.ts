import { expect } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { test } from '@porcelain/server/kit/server-test';
import {
  branchQueryOptions,
  branchDiffsQueryOptions,
} from '@porcelain/client/changes';
import { connection } from '../kit/connection.ts';

test('read the branch range and its patch using the same selected revisions', async ({
  server,
  session,
}) => {
  await session.git('branch', 'base');
  await session.git('commit', '-am', 'Update the readme');
  const { connected, scope } = await connection(server, session);
  const cache = new QueryClient();
  const branch = await cache.query(
    branchQueryOptions(scope, connected, 'refs/heads/base'),
  );
  expect(branch.worktreeId).toBe(scope.worktreeId);
  expect(branch.commits).toBe(1);
  expect(branch.base?.ref).toBe('refs/heads/base');
  expect(branch.files.map((file) => file.path)).toEqual([
    session.fixture.readme.path,
  ]);
  if (!branch.base) throw new Error('Expected the selected base');
  const diffs = await cache.query(
    branchDiffsQueryOptions(scope, connected, {
      baseOid: branch.base.oid,
      headOid: branch.head.oid,
      paths: [[session.fixture.readme.path]],
    }),
  );
  expect(diffs.diffs).toEqual([
    {
      paths: [session.fixture.readme.path],
      content: {
        kind: 'text',
        patch: await session.git(
          'diff',
          'base',
          'HEAD',
          '--',
          session.fixture.readme.path,
        ),
      },
    },
  ]);
});
