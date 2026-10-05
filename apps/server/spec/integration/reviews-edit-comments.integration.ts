import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import {
  deleteCommentMessageResponseSchema,
  editCommentMessageResponseSchema,
} from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  UNKNOWN_UUID,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import {
  read,
  toolCall,
  toolValue,
  worktreePath,
  sendAll,
  answered,
} from '../kit/requests.ts';
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
const QUESTION = 'Why this line?';
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

test('the reviewer rewrites their comment in place, stamped and at the next revision, and the agent reads the new text', async ({
  session,
}) => {
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      threadId,
      messageId: questionId,
      anchor: { kind: 'file', filePath: 'README.md' },
      body: QUESTION,
    },
  });
  await read(
    session,
    toolCall(session, 1, 'reply_to_comment', {
      threadId,
      messageId: answerId,
      body: ANSWER,
    }),
  );
  const before = record(await threadOf(session, threadId));

  const response = await session.send(
    edit(session, threadId, questionId, REWRITTEN),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(editCommentMessageResponseSchema),
      ),
    ),
  );
  expect(response.body).toMatchObject({
    id: threadId,
    messages: [
      { id: questionId, body: REWRITTEN, author: 'reviewer' },
      { id: answerId, body: ANSWER, author: 'agent' },
    ],
    revision: Number(before.revision) + 1,
  });
  expect(
    String(record(list(record(response.body).messages)[0]).editedAt),
  ).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  const listed = await read(
    session,
    toolCall(session, 2, 'list_comments', { scope: 'all' }),
  );
  expect(listed).toMatchObject(answered(2));
  expect(toolValue(listed)).toMatchObject([
    {
      id: threadId,
      messages: [
        { id: questionId, body: REWRITTEN },
        { id: answerId, body: ANSWER },
      ],
    },
  ]);
});

test('rewriting a comment with the same text changes nothing', async ({
  session,
}) => {
  const before = record(await threadOf(session, threadId));

  const response = await session.send(
    edit(session, threadId, questionId, REWRITTEN),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual(before);
});

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

test('deleting the last message of a thread removes the thread for the reviewer and the agent', async ({
  session,
}) => {
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      threadId: loneThreadId,
      messageId: loneMessageId,
      anchor: { kind: 'file', filePath: 'README.md' },
      body: 'Never mind',
    },
  });

  const response = await session.send(
    remove(session, loneThreadId, loneMessageId),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ threadId: loneThreadId, thread: null });
  const listed = await read(
    session,
    toolCall(session, 3, 'list_comments', { scope: 'all' }),
  );
  expect(listed).toMatchObject(answered(3));
  expect(
    list(toolValue(listed)).map((entry) => record(entry).id),
  ).toStrictEqual([threadId]);
  expect(
    (await threads(session)).map((entry) => record(entry).id),
  ).toStrictEqual([threadId]);
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
