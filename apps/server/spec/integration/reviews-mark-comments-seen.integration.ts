import * as Schema from 'effect/Schema';
import { markCommentsSeenResponseSchema } from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import {
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { type HttpRequest, type Session } from '../kit/session.ts';

const seen = (session: Session, throughRevision: unknown): HttpRequest => ({
  method: 'POST',
  path: worktreePath(session, '/comments/seen'),
  body: { throughRevision },
});

async function twoThreads(session: Session) {
  for (const body of ['First', 'Second'])
    await session.read({
      method: 'POST',
      path: worktreePath(session, '/comments'),
      body: { anchor: { kind: 'file', filePath: 'README.md' }, body },
    });
}

test('marking comments seen through an existing revision records that revision', async ({
  session,
}) => {
  await twoThreads(session);

  const response = await session.send(seen(session, 1));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(markCommentsSeenResponseSchema),
      ),
    ),
  );
  expect(response.body).toStrictEqual({
    worktreeId: session.worktreeId,
    seenThrough: 1,
  });
});

test('marking comments seen beyond the latest revision is clamped to the latest', async ({
  session,
}) => {
  const response = await session.send(seen(session, 9999));

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    worktreeId: session.worktreeId,
    seenThrough: 2,
  });
});

test('marking comments seen through an earlier revision never moves the mark back', async ({
  session,
}) => {
  const response = await session.send(seen(session, 1));

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    worktreeId: session.worktreeId,
    seenThrough: 2,
  });
});

test('marking comments seen with an invalid revision or on an unknown worktree is refused', async ({
  session,
}) => {
  const negative = await session.send(seen(session, -1));
  const word = await session.send(seen(session, 'all'));
  const unknown = await session.send({
    method: 'POST',
    path: `/api/worktrees/${unknownWorktreeId}/comments/seen`,
    body: { throughRevision: 1 },
  });

  for (const response of [negative, word]) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
});
