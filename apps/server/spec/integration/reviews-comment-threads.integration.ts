import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import {
  createCommentThreadResponseSchema,
  listCommentThreadsResponseSchema,
  replyToCommentResponseSchema,
  updateCommentThreadResponseSchema,
} from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  UNKNOWN_UUID,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { worktreePath, sendAll } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, type Session } from '../kit/session.ts';

const comments = (session: Session, suffix = '') =>
  worktreePath(session, `/comments${suffix}`);
const targetNotFound = apiError(404, 'Not Found', 'Comment target not found');
const fileAnchor = { kind: 'file', filePath: 'README.md' };
const threadId = randomUUID();
const messageId = randomUUID();

function thread(value: unknown, id: string) {
  const written = record(value);
  if (written.id !== id) throw new Error(`Thread ${id} was not written`);
  return written;
}

test('a worktree without comments lists no threads', async ({ session }) => {
  const response = await session.send({
    method: 'GET',
    path: comments(session),
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual([]);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(listCommentThreadsResponseSchema),
      ),
    ),
  );
});

test('creating a file thread and a line-range thread answers each written thread and bumps the comment revision', async ({
  session,
}) => {
  const fileThread = await session.send({
    method: 'POST',
    path: comments(session),
    body: { threadId, messageId, anchor: fileAnchor, body: 'Looks good' },
  });
  const rangeThread = await session.send({
    method: 'POST',
    path: comments(session),
    body: {
      anchor: {
        kind: 'codeRange',
        filePath: 'README.md',
        startLine: 3,
        endLine: 3,
        side: 'additions',
        comparison: { kind: 'worktree', scope: 'unstaged' },
      },
      body: 'Why this line?',
    },
  });

  expect([fileThread.status, rangeThread.status]).toStrictEqual([200, 200]);
  expect(rangeThread.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(createCommentThreadResponseSchema),
      ),
    ),
  );
  expect(thread(fileThread.body, threadId)).toMatchObject({
    id: threadId,
    worktreeId: session.worktreeId,
    anchor: fileAnchor,
    resolved: false,
    messages: [{ id: messageId, body: 'Looks good', author: 'reviewer' }],
    revision: 1,
  });
  expect(fileThread.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(createCommentThreadResponseSchema),
      ),
    ),
  );
  const listed = await session.read({
    method: 'GET',
    path: comments(session),
  });
  expect(listed.body).toStrictEqual([fileThread.body, rangeThread.body]);
  expect(
    list(listed.body)
      .map((entry) => Number(record(entry).revision))
      .sort((left, right) => left - right),
  ).toStrictEqual([1, 2]);
});

test('retrying a create with the same ids changes nothing, and reusing them for different content is a conflict', async ({
  session,
}) => {
  const retry = await session.send({
    method: 'POST',
    path: comments(session),
    body: { threadId, messageId, anchor: fileAnchor, body: 'Looks good' },
  });
  const conflict = await session.send({
    method: 'POST',
    path: comments(session),
    body: {
      threadId,
      messageId,
      anchor: fileAnchor,
      body: 'Something else',
    },
  });

  expect(retry.status).toBe(200);
  expect(thread(retry.body, threadId).revision).toBe(1);
  expect(
    list((await session.read({ method: 'GET', path: comments(session) })).body),
  ).toHaveLength(2);
  expect(conflict.status).toBe(409);
  expect(conflict.body).toStrictEqual(
    apiError(409, 'Conflict', 'Comment ID belongs to a different write'),
  );
});

test('replying to a thread appends a reviewer message and resolving it marks it resolved, each bumping the revision', async ({
  session,
}) => {
  const reply = await session.send({
    method: 'POST',
    path: comments(session, `/${threadId}/replies`),
    body: { body: 'Thanks' },
  });
  const resolution = await session.send({
    method: 'PUT',
    path: comments(session, `/${threadId}/resolution`),
    body: { resolved: true },
  });

  expect([reply.status, resolution.status]).toStrictEqual([200, 200]);
  expect(reply.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(replyToCommentResponseSchema)),
    ),
  );
  expect(resolution.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(updateCommentThreadResponseSchema),
      ),
    ),
  );
  expect(thread(reply.body, threadId)).toMatchObject({
    resolved: false,
    messages: [{ body: 'Looks good' }, { body: 'Thanks', author: 'reviewer' }],
    revision: 3,
  });
  expect(thread(resolution.body, threadId)).toMatchObject({
    resolved: true,
    revision: 4,
  });
});

test('a thread anchored to a file that does not exist is accepted', async ({
  session,
}) => {
  const response = await session.send({
    method: 'POST',
    path: comments(session),
    body: {
      anchor: { kind: 'file', filePath: 'missing.md' },
      body: 'Where?',
    },
  });

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    anchor: { kind: 'file', filePath: 'missing.md' },
  });
});

test('replying to or resolving a thread the server does not know is not found', async ({
  session,
}) => {
  const responses = await sendAll(session, [
    {
      method: 'POST',
      path: comments(session, `/${UNKNOWN_UUID}/replies`),
      body: { body: 'Hello?' },
    },
    {
      method: 'PUT',
      path: comments(session, `/${UNKNOWN_UUID}/resolution`),
      body: { resolved: true },
    },
  ]);

  for (const response of responses) {
    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual(targetNotFound);
  }
});

test('a blank comment, a backwards line range, a reply without a body or a resolution that is not a boolean is refused', async ({
  session,
}) => {
  const responses = await sendAll(session, [
    {
      method: 'POST',
      path: comments(session),
      body: { anchor: fileAnchor, body: '   ' },
    },
    {
      method: 'POST',
      path: comments(session),
      body: {
        anchor: {
          kind: 'codeRange',
          filePath: 'README.md',
          startLine: 3,
          endLine: 2,
        },
        body: 'Backwards',
      },
    },
    {
      method: 'POST',
      path: comments(session, `/${threadId}/replies`),
      body: {},
    },
    {
      method: 'PUT',
      path: comments(session, `/${threadId}/resolution`),
      body: { resolved: 'yes' },
    },
  ]);

  for (const response of responses) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
});

test('listing, creating, replying to or resolving comments on an unknown worktree is not found', async ({
  session,
}) => {
  const [listed, created, replied, resolved] = await sendAll(session, [
    { method: 'GET', path: `/api/worktrees/${unknownWorktreeId}/comments` },
    {
      method: 'POST',
      path: `/api/worktrees/${unknownWorktreeId}/comments`,
      body: { anchor: fileAnchor, body: 'Hello' },
    },
    {
      method: 'POST',
      path: `/api/worktrees/${unknownWorktreeId}/comments/${threadId}/replies`,
      body: { body: 'Hello' },
    },
    {
      method: 'PUT',
      path: `/api/worktrees/${unknownWorktreeId}/comments/${threadId}/resolution`,
      body: { resolved: false },
    },
  ]);

  expect(
    [listed, created, replied, resolved].map((entry) => entry?.status),
  ).toStrictEqual([404, 404, 404, 404]);
  expect(listed?.body).toStrictEqual(worktreeNotFound);
  expect(created?.body).toStrictEqual(worktreeNotFound);
  expect(replied?.body).toStrictEqual(worktreeNotFound);
  expect(resolved?.body).toStrictEqual(worktreeNotFound);
});
