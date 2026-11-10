import { randomUUID } from 'node:crypto';

import { expect } from 'vitest';
import {
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const answeredId = randomUUID();
const notedId = randomUUID();
const openId = randomUUID();
const fromAgentId = randomUUID();

const threads = async (session: Session) =>
  list(
    (
      await session.read({
        method: 'GET',
        path: worktreePath(session, '/comments'),
      })
    ).body,
  ).map((entry) => record(entry).id);

const deleteResolved = (
  session: Session,
  threads: readonly unknown[],
  worktree = session.worktreeId,
): HttpRequest => ({
  method: 'POST',
  path: `/api/worktrees/${worktree}/comments/resolved/deletion`,
  body: { threads },
});

test('deleting an already deleted thread deletes nothing, an empty or malformed list is refused and an unknown worktree is not found', async ({
  session,
}) => {
  const again = await session.send(
    deleteResolved(session, [{ threadId: answeredId, revision: 1 }]),
  );
  const empty = await session.send(deleteResolved(session, []));
  const malformed = await session.send(
    deleteResolved(session, [{ threadId: answeredId }]),
  );
  const unknown = await session.send(
    deleteResolved(
      session,
      [{ threadId: answeredId, revision: 1 }],
      unknownWorktreeId,
    ),
  );

  expect(
    [again, empty, malformed, unknown].map((entry) => entry.status),
  ).toStrictEqual([200, 400, 400, 404]);
  expect(again.body).toStrictEqual({ deleted: [], skipped: [answeredId] });
  expect(empty.body).toStrictEqual(invalidRequest);
  expect(malformed.body).toStrictEqual(invalidRequest);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
  expect(await threads(session)).toStrictEqual([notedId, openId, fromAgentId]);
});
