import { deleteCommentMessageResponseSchema } from '@porcelain/contracts/reviews';
import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  UNKNOWN_UUID,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { read, sendAll, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const threadId = randomUUID();
const questionId = randomUUID();
const answerId = randomUUID();
const followUpId = randomUUID();
const loneThreadId = randomUUID();
const loneMessageId = randomUUID();

const REWRITTEN = 'Why does this line change the heading?';
const ANSWER = 'It names the new section.';
const targetNotFound = apiError(404, 'Not Found', 'Comment target not found');
const notTheAuthor = apiError(
  403,
  'Forbidden',
  'Only the author of a comment may change it',
);
const messages = (session: Session, thread: string) =>
  worktreePath(session, `/comments/${thread}/messages`);
const edit = (
  session: Session,
  thread: string,
  id: string,
  body: string,
): HttpRequest => ({
  method: 'PATCH',
  path: messages(session, thread),
  body: { messageId: id, body },
});
const remove = (session: Session, thread: string, id: string): HttpRequest => ({
  method: 'DELETE',
  path: messages(session, thread),
  query: { messageId: id },
});
const threads = async (session: Session) =>
  list(
    (
      await session.read({
        method: 'GET',
        path: worktreePath(session, '/comments'),
      })
    ).body,
  );
const threadOf = async (session: Session, id: string) =>
  (await threads(session)).find((entry) => record(entry).id === id);

test("a reviewer cannot rewrite or delete the agent's message and the thread stays unchanged", async ({
  session,
}) => {
  const before = record(await threadOf(session, threadId));

  const edited = await session.send(
    edit(session, threadId, answerId, 'Rewritten by someone else'),
  );
  const deleted = await session.send(remove(session, threadId, answerId));

  expect([edited.status, deleted.status]).toStrictEqual([403, 403]);
  expect(edited.body).toStrictEqual(notTheAuthor);
  expect(deleted.body).toStrictEqual(notTheAuthor);
  expect(await threadOf(session, threadId)).toStrictEqual(before);
});

test('the reviewer deletes a reply and the rest of the thread stays at the next revision', async ({
  session,
}) => {
  await read(session, {
    method: 'POST',
    path: worktreePath(session, `/comments/${threadId}/replies`),
    body: { messageId: followUpId, body: 'Thanks' },
  });
  const before = record(await threadOf(session, threadId));

  const response = await session.send(remove(session, threadId, followUpId));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(deleteCommentMessageResponseSchema),
      ),
    ),
  );
  expect(response.body).toMatchObject({
    threadId,
    thread: {
      id: threadId,
      messages: [
        { id: questionId, body: REWRITTEN },
        { id: answerId, body: ANSWER },
      ],
      revision: Number(before.revision) + 1,
    },
  });
  expect(await threadOf(session, threadId)).toStrictEqual(
    record(response.body).thread,
  );
});

test('a blank rewrite is refused, and an unknown message, unknown or deleted thread or unknown worktree is not found', async ({
  session,
}) => {
  const [blank, unknownMessage, unknownThread, deletedThread, unknownWorktree] =
    await sendAll(session, [
      edit(session, threadId, questionId, '   '),
      edit(session, threadId, UNKNOWN_UUID, 'Hello'),
      remove(session, UNKNOWN_UUID, questionId),
      remove(session, loneThreadId, loneMessageId),
      {
        method: 'PATCH',
        path: `/api/worktrees/${unknownWorktreeId}/comments/${threadId}/messages`,
        body: { messageId: questionId, body: 'Hello' },
      },
    ]);

  expect(
    [blank, unknownMessage, unknownThread, deletedThread, unknownWorktree].map(
      (entry) => entry?.status,
    ),
  ).toStrictEqual([400, 404, 404, 404, 404]);
  expect(blank?.body).toStrictEqual(invalidRequest);
  expect(unknownMessage?.body).toStrictEqual(targetNotFound);
  expect(unknownThread?.body).toStrictEqual(targetNotFound);
  expect(deletedThread?.body).toStrictEqual(targetNotFound);
  expect(unknownWorktree?.body).toStrictEqual(worktreeNotFound);
});
