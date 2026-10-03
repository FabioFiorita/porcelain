import { readCommitDiffsResponseSchema } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownOid,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { threeCommits } from '../kit/reads.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, type HttpRequest, type Session } from '../kit/session.ts';

function diffs(session: Session, oid: string, body: unknown): HttpRequest {
  return {
    method: 'POST',
    path: worktreePath(session, `/commits/${oid}/diffs`),
    body,
  };
}

test('commit diffs return the patch of a modified file and a metadata-only patch for a pure rename', async ({
  session,
}) => {
  const commits = await threeCommits(session);
  const path = session.fixture.readme.path;
  const modified = await session.git(
    'diff',
    commits.initial,
    commits.second,
    '--',
    path,
  );
  const renamed = await session.git(
    'diff',
    '-M',
    commits.second,
    commits.rename,
    '--',
    path,
    'GUIDE.md',
  );

  const responses = [
    await session.send(
      diffs(session, commits.second, {
        paths: [[session.fixture.readme.path]],
      }),
    ),
    await session.send(
      diffs(session, commits.rename, {
        paths: [[session.fixture.readme.path, 'GUIDE.md']],
      }),
    ),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([200, 200]);
  expect(responses[0]?.body).toEqual(
    expect.schemaMatching(readCommitDiffsResponseSchema),
  );
  expect(responses[0]?.body).toStrictEqual({
    commitOid: commits.second,
    diffs: [
      {
        paths: [session.fixture.readme.path],
        content: { kind: 'text', patch: modified },
      },
    ],
  });
  expect(responses[1]?.body).toStrictEqual({
    commitOid: commits.rename,
    diffs: [
      {
        paths: [session.fixture.readme.path, 'GUIDE.md'],
        content: { kind: 'metadata-only', patch: renamed },
      },
    ],
  });
});

test('the commit diff of a path the commit did not touch is an empty metadata-only patch', async ({
  session,
}) => {
  const head = (await session.git('rev-parse', 'HEAD')).trim();

  const response = await session.send(
    diffs(session, head, { paths: [['untouched.md']] }),
  );

  expect(response.status).toBe(200);
  expect(record(response.body).diffs).toStrictEqual([
    {
      paths: ['untouched.md'],
      content: { kind: 'metadata-only', patch: '' },
    },
  ]);
});

test('commit diffs of an unknown commit are not found, and a parent the commit does not have is refused', async ({
  session,
}) => {
  const head = (await session.git('rev-parse', 'HEAD')).trim();

  const responses = [
    await session.send(diffs(session, unknownOid, { paths: [['README.md']] })),
    await session.send(
      diffs(session, head, { parent: 2, paths: [['README.md']] }),
    ),
  ];

  expect(responses[0]?.status).toBe(404);
  expect(responses[0]?.body).toStrictEqual(
    apiError(404, 'Not Found', 'Commit not found'),
  );
  expect(responses[1]?.status).toBe(400);
  expect(responses[1]?.body).toStrictEqual(
    apiError(400, 'Bad Request', 'Invalid history request'),
  );
});

test('commit diffs with no paths or a path group of three are refused, and an unknown worktree is not found', async ({
  session,
}) => {
  const responses = [
    await session.send(diffs(session, unknownOid, { paths: [] })),
    await session.send(
      diffs(session, unknownOid, { paths: [['a', 'b', 'c']] }),
    ),
    await session.send({
      method: 'POST',
      path: `/api/worktrees/${unknownWorktreeId}/commits/${unknownOid}/diffs`,
      body: { paths: [['README.md']] },
    }),
  ];

  for (const response of responses.slice(0, 2)) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
  expect(responses[2]?.status).toBe(404);
  expect(responses[2]?.body).toStrictEqual(worktreeNotFound);
});
