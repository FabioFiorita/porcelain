import { readChangeDiffsResponseSchema } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownFingerprint,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { changes, fingerprintOf, inventory } from '../kit/reads.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import type { Session } from '../kit/session.ts';

const refresh = apiError(
  409,
  'Conflict',
  'Refresh status and retry inspection',
  'worktree_changed',
);

function unstaged(session: Session) {
  return {
    scope: 'unstaged',
    oldPath: session.fixture.readme.path,
    newPath: session.fixture.readme.path,
  };
}

async function seen(session: Session) {
  return {
    ...(await changes(session)),
    fingerprint: await fingerprintOf(session, session.fixture.readme.path),
  };
}

function diffs(
  session: Session,
  statusToken: string,
  fingerprint: string | null,
  selection: object = unstaged(session),
) {
  return {
    expectedStatusToken: statusToken,
    expectedFiles: [{ path: session.fixture.readme.path, fingerprint }],
    selections: [selection],
  };
}

test('reading the diff of the sample change returns the patch Git reports for the state the reviewer saw', async ({
  session,
}) => {
  const state = await seen(session);
  const environmentId = (await inventory(session)).environmentId;
  const patch = await session.git('diff', '--', session.fixture.readme.path);

  const response = await session.send({
    method: 'POST',
    path: worktreePath(session, '/changes/diffs'),
    body: diffs(session, state.statusToken, state.fingerprint),
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(readChangeDiffsResponseSchema),
  );
  expect(response.body).toStrictEqual({
    environmentId,
    worktreeId: session.worktreeId,
    statusToken: state.statusToken,
    diffs: [
      {
        selection: unstaged(session),
        content: { kind: 'text', patch },
      },
    ],
  });
});

test('reading diffs with a selection that is not one of the stated files is refused', async ({
  session,
}) => {
  const state = await seen(session);

  const response = await session.send({
    method: 'POST',
    path: worktreePath(session, '/changes/diffs'),
    body: diffs(session, state.statusToken, state.fingerprint, {
      scope: 'staged',
      oldPath: 'other.md',
      newPath: 'other.md',
    }),
  });

  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(invalidRequest);
});

test('reading diffs for a stated file whose selection is no longer listed asks the reviewer to refresh', async ({
  session,
}) => {
  const state = await seen(session);

  const response = await session.send({
    method: 'POST',
    path: worktreePath(session, '/changes/diffs'),
    body: diffs(session, state.statusToken, state.fingerprint, {
      ...unstaged(session),
      scope: 'staged',
    }),
  });

  expect(response.status).toBe(409);
  expect(response.body).toStrictEqual(refresh);
});

test('reading diffs with a stale status token or a stale fingerprint asks the reviewer to refresh', async ({
  session,
}) => {
  const state = await seen(session);

  const responses = [
    await session.send({
      method: 'POST',
      path: worktreePath(session, '/changes/diffs'),
      body: diffs(session, unknownFingerprint, state.fingerprint),
    }),
    await session.send({
      method: 'POST',
      path: worktreePath(session, '/changes/diffs'),
      body: diffs(session, state.statusToken, unknownFingerprint),
    }),
  ];

  for (const response of responses) {
    expect(response.status).toBe(409);
    expect(response.body).toStrictEqual(refresh);
  }
});

test('reading diffs after the worktree moved since the status was read asks the reviewer to refresh', async ({
  session,
}) => {
  const state = await seen(session);
  await session.writeFile(session.fixture.readme.path, 'Edited again\n');

  const response = await session.send({
    method: 'POST',
    path: worktreePath(session, '/changes/diffs'),
    body: diffs(session, state.statusToken, state.fingerprint),
  });

  expect(response.status).toBe(409);
  expect(response.body).toStrictEqual(refresh);
});

test('reading diffs with no selections is refused, and an unknown worktree is not found', async ({
  session,
}) => {
  const state = await changes(session);

  const responses = [
    await session.send({
      method: 'POST',
      path: worktreePath(session, '/changes/diffs'),
      body: {
        expectedStatusToken: state.statusToken,
        expectedFiles: [],
        selections: [],
      },
    }),
    await session.send({
      method: 'POST',
      path: `/api/worktrees/${unknownWorktreeId}/changes/diffs`,
      body: diffs(session, state.statusToken, null),
    }),
  ];

  expect(responses[0]?.status).toBe(400);
  expect(responses[0]?.body).toStrictEqual(invalidRequest);
  expect(responses[1]?.status).toBe(404);
  expect(responses[1]?.body).toStrictEqual(worktreeNotFound);
});
