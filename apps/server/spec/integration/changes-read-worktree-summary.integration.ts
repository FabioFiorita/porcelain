import { readWorktreeSummaryResponseSchema } from '@porcelain/contracts/changes';
import * as Schema from 'effect/Schema';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import { read, worktreePath } from '../kit/requests.ts';

test('returns only scoped local diff totals without changing the index and rejects missing or unpaired scopes', async ({
  session,
}) => {
  await session.writeFile('summary.txt', 'one\ntwo\n');
  await session.git('add', '--all');
  await session.git('commit', '-qm', 'Prepare summary baseline');
  await session.writeFile('summary.txt', 'one\nchanged\nmore\n');
  await session.git('add', 'summary.txt');
  await session.writeFile('summary.txt', 'one\nfinal\nmore\n');
  await session.writeFile('untracked-summary.txt', 'new\n');
  const before = await session.git('diff', '--cached', '--numstat');
  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/summary'),
  });
  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(readWorktreeSummaryResponseSchema),
    ),
  );
  expect(response.body).toEqual({
    environmentId: Schema.decodeUnknownSync(readWorktreeSummaryResponseSchema)(
      response.body,
    ).environmentId,
    worktreeId: session.worktreeId,
    additions: 3,
    deletions: 1,
    binaryFiles: 0,
  });
  expect(await session.git('diff', '--cached', '--numstat')).toBe(before);
  await read(
    session,
    {
      method: 'GET',
      path: '/api/worktrees/ffffffffffffffffffffffffffffffff/summary',
    },
    404,
  );
  await read(
    session,
    { method: 'GET', path: worktreePath(session, '/summary'), auth: 'none' },
    401,
  );
});
