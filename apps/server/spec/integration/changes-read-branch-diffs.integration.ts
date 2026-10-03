import { readBranchDiffsResponseSchema } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownOid,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { head } from '../kit/reads.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import type { HttpRequest, Session } from '../kit/session.ts';

function diffs(session: Session, body: unknown): HttpRequest {
  return {
    method: 'POST',
    path: worktreePath(session, '/branch-changes/diffs'),
    body,
  };
}

test('branch diffs are the patches between the fork point and the tip, not the uncommitted edit', async ({
  session,
}) => {
  const fork = await head(session);
  await session.git('switch', '-c', 'feature');
  await session.git('mv', session.fixture.readme.path, 'GUIDE.md');
  await session.git('commit', '-m', 'Rename the readme');
  await session.writeFile('notes.md', 'notes\n');
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Add notes');
  await session.writeFile('notes.md', 'uncommitted\n');
  const tip = await head(session);
  const renamed = await session.git(
    'diff',
    '-M',
    fork,
    tip,
    '--',
    session.fixture.readme.path,
    'GUIDE.md',
  );
  const added = await session.git('diff', fork, tip, '--', 'notes.md');

  const response = await session.send(
    diffs(session, {
      baseOid: fork,
      headOid: tip,
      paths: [[session.fixture.readme.path, 'GUIDE.md'], ['notes.md']],
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(readBranchDiffsResponseSchema),
  );
  expect(response.body).toStrictEqual({
    diffs: [
      {
        paths: [session.fixture.readme.path, 'GUIDE.md'],
        content: { kind: 'metadata-only', patch: renamed },
      },
      {
        paths: ['notes.md'],
        content: { kind: 'text', patch: added },
      },
    ],
  });
});

test('branch diffs of a rename the listing reported apart are a deletion and an addition, each under its own path', async ({
  session,
}) => {
  const fork = (await session.git('rev-parse', 'feature~2')).trim();
  const tip = await head(session);
  const deleted = await session.git(
    'diff',
    '--no-renames',
    fork,
    tip,
    '--',
    session.fixture.readme.path,
  );
  const added = await session.git(
    'diff',
    '--no-renames',
    fork,
    tip,
    '--',
    'GUIDE.md',
  );

  const response = await session.send(
    diffs(session, {
      baseOid: fork,
      headOid: tip,
      paths: [[session.fixture.readme.path], ['GUIDE.md']],
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    diffs: [
      {
        paths: [session.fixture.readme.path],
        content: { kind: 'text', patch: deleted },
      },
      {
        paths: ['GUIDE.md'],
        content: { kind: 'text', patch: added },
      },
    ],
  });
});

test('branch diffs that ask for a path the branch did not change are refused rather than shown as unchanged', async ({
  session,
}) => {
  const fork = (await session.git('rev-parse', 'feature~2')).trim();
  const tip = await head(session);

  const response = await session.send(
    diffs(session, {
      baseOid: fork,
      headOid: tip,
      paths: [['notes.md'], ['untouched.md']],
    }),
  );

  expect(response.status).toBe(422);
  expect(response.body).toStrictEqual(
    apiError(
      422,
      'Unprocessable Entity',
      'Diff read returned fewer results than requested',
    ),
  );
});

test('branch diffs from a commit the repository does not have are not found', async ({
  session,
}) => {
  const tip = await head(session);

  const response = await session.send(
    diffs(session, {
      baseOid: unknownOid,
      headOid: tip,
      paths: [['GUIDE.md']],
    }),
  );

  expect(response.status).toBe(404);
  expect(response.body).toStrictEqual(
    apiError(404, 'Not Found', 'Commit not found'),
  );
});

test('branch diffs with no paths or a base that is not a commit id are refused, and an unknown worktree is not found', async ({
  session,
}) => {
  const responses = [
    await session.send(
      diffs(session, { baseOid: unknownOid, headOid: unknownOid, paths: [] }),
    ),
    await session.send(
      diffs(session, {
        baseOid: 'main',
        headOid: unknownOid,
        paths: [['a']],
      }),
    ),
    await session.send({
      method: 'POST',
      path: `/api/worktrees/${unknownWorktreeId}/branch-changes/diffs`,
      body: { baseOid: unknownOid, headOid: unknownOid, paths: [['a']] },
    }),
  ];

  for (const response of responses.slice(0, 2)) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
  expect(responses[2]?.status).toBe(404);
  expect(responses[2]?.body).toStrictEqual(worktreeNotFound);
});
