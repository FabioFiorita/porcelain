import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import { deleteResolvedCommentsResponseSchema } from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import {
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import {
  read,
  toolCall,
  toolValue,
  worktreePath,
  answered,
} from '../kit/requests.ts';
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
const anchor = { kind: 'file', filePath: 'README.md' };
const threads = async (session: Session) =>
  list(
    (
      await session.read({
        method: 'GET',
        path: worktreePath(session, '/comments'),
      })
    ).body,
  ).map((entry) => record(entry).id);
const resolve = (session: Session, threadId: string) =>
  read(session, {
    method: 'PUT',
    path: worktreePath(session, `/comments/${threadId}/resolution`),
    body: { resolved: true },
  });
const revisions = async (session: Session, ...threadIds: string[]) => {
  const listed = list(
    (
      await session.read({
        method: 'GET',
        path: worktreePath(session, '/comments'),
      })
    ).body,
  ).map(record);
  return threadIds.map((threadId) => ({
    threadId,
    revision: listed.find((entry) => entry.id === threadId)?.revision,
  }));
};
const deleteResolved = (
  session: Session,
  threads: readonly unknown[],
  worktree = session.worktreeId,
): HttpRequest => ({
  method: 'POST',
  path: `/api/worktrees/${worktree}/comments/resolved/deletion`,
  body: { threads },
});

test("deleting confirmed resolved threads removes the reviewer's whole threads and keeps agent-started, changed, open threads, also for the agent", async ({
  session,
}) => {
  for (const { threadId, body } of [
    { threadId: answeredId, body: 'Why this heading?' },
    { threadId: notedId, body: 'Note to self' },
    { threadId: openId, body: 'Still open' },
  ])
    await read(session, {
      method: 'POST',
      path: worktreePath(session, '/comments'),
      body: { threadId, anchor, body },
    });
  await read(
    session,
    toolCall(session, 1, 'reply_to_comment', {
      threadId: answeredId,
      body: 'It names the new section.',
    }),
  );
  await read(
    session,
    toolCall(session, 2, 'create_comment', {
      threadId: fromAgentId,
      anchor,
      body: 'I left the old heading in the changelog.',
    }),
  );
  for (const threadId of [answeredId, notedId, fromAgentId])
    await resolve(session, threadId);
  const confirmed = await revisions(
    session,
    answeredId,
    notedId,
    fromAgentId,
    openId,
  );
  await read(
    session,
    toolCall(session, 3, 'reply_to_comment', {
      threadId: notedId,
      body: 'Noted, and one more thing.',
    }),
  );

  const response = await session.send(deleteResolved(session, confirmed));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(deleteResolvedCommentsResponseSchema),
      ),
    ),
  );
  expect(response.body).toStrictEqual({
    deleted: [answeredId],
    skipped: [notedId, fromAgentId, openId],
  });
  expect(await threads(session)).toStrictEqual([notedId, openId, fromAgentId]);
  const listed = await read(
    session,
    toolCall(session, 4, 'list_comments', { scope: 'all' }),
  );
  expect(listed).toMatchObject(answered(4));
  expect(
    list(record(toolValue(listed)).threads).map((entry) => record(entry).id),
  ).toStrictEqual([notedId, openId, fromAgentId]);
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
