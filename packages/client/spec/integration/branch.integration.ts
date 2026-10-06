import { expect } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import { readBranchChanges, readBranchDiffs } from '@porcelain/client/changes';
import { connection } from '../kit/connection.ts';

test('read the branch range and its patch using the same selected revisions', async ({
  server,
  session,
}) => {
  await session.git('branch', 'base');
  await session.git('commit', '-am', 'Update the readme');
  const { connected, scope, read } = await connection(server, session);
  const branch = await read(
    readBranchChanges({
      scope,
      connection: connected,
      base: 'refs/heads/base',
    }),
  );
  expect(branch.worktreeId).toBe(scope.worktreeId);
  expect(branch.commits).toBe(1);
  expect(branch.base?.ref).toBe('refs/heads/base');
  expect(branch.files.map((file) => file.path)).toEqual([
    session.fixture.readme.path,
  ]);
  if (!branch.base) throw new Error('Expected the selected base');
  const diffs = await read(
    readBranchDiffs({
      scope,
      connection: connected,
      input: {
        baseOid: branch.base.oid,
        headOid: branch.head.oid,
        paths: [[session.fixture.readme.path]],
      },
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
