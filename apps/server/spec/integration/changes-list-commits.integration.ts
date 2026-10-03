import { listCommitsResponseSchema } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import {
  invalidRequest,
  unknownOid,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { threeCommits } from '../kit/reads.ts';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

function commits(
  session: Session,
  query?: Record<string, string | number>,
): HttpRequest {
  return {
    method: 'GET',
    path: worktreePath(session, '/commits'),
    ...(query ? { query } : {}),
  };
}

const author = {
  name: 'Porcelain Verification',
  timestamp: '2026-01-01T00:00:00.000Z',
};

test('the first page of history snapshots the head and returns the newest commit with the cursor for the next', async ({
  session,
}) => {
  const state = await threeCommits(session);

  const response = await session.send(commits(session, { limit: 1 }));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(listCommitsResponseSchema),
  );
  expect(response.body).toStrictEqual({
    snapshot: {
      tipOid: state.rename,
      head: {
        kind: 'attached',
        ref: `refs/heads/${session.fixture.branch}`,
      },
    },
    commits: [
      {
        oid: state.rename,
        parentOids: [state.second],
        author,
        subject: 'Rename',
        subjectTruncated: false,
        body: null,
        bodyTruncated: false,
        refs: [session.fixture.branch],
      },
    ],
    nextAfter: [state.second],
    tip: state.rename,
    boundary: null,
    restarted: false,
  });
});

test('continuing from the cursor returns the older commits from the same tip and ends the history', async ({
  session,
}) => {
  const first = await read(session, commits(session, { limit: 1 }));

  const response = await session.send(
    commits(session, {
      limit: 2,
      after: list(first.nextAfter).join(','),
      tip: String(first.tip),
    }),
  );

  expect(response.status).toBe(200);
  const body = record(response.body);
  expect(body.snapshot).toBe(null);
  expect(body.tip).toBe(first.tip);
  expect(body.commits).toMatchObject([
    { subject: 'Second commit', body: 'With a body' },
    { subject: session.fixture.initialCommit, parentOids: [] },
  ]);
  expect(body.nextAfter).toBe(null);
});

test('continuing from a tip that is no longer the snapshot restarts the listing from the current head', async ({
  session,
}) => {
  const first = await read(session, commits(session, { limit: 1 }));

  const response = await session.send(
    commits(session, {
      limit: 1,
      after: list(first.nextAfter).join(','),
      tip: unknownOid,
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    restarted: true,
    tip: first.tip,
    commits: [{ subject: 'Rename' }],
  });
});

test('listing history with an invalid limit or cursor is refused, and an unknown worktree is not found', async ({
  session,
}) => {
  const responses = [
    await session.send(commits(session, { limit: 0 })),
    await session.send(commits(session, { after: 'not-an-oid' })),
    await session.send({
      method: 'GET',
      path: `/api/worktrees/${unknownWorktreeId}/commits`,
    }),
  ];

  for (const response of responses.slice(0, 2)) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
  expect(responses[2]?.status).toBe(404);
  expect(responses[2]?.body).toStrictEqual(worktreeNotFound);
});
