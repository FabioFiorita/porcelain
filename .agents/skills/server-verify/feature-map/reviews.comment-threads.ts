import { randomUUID } from 'node:crypto';
import {
  createCommentThreadResponseSchema,
  listCommentThreadsResponseSchema,
  replyToCommentResponseSchema,
  resolveCommentThreadResponseSchema,
} from '../../../../packages/contracts/src/reviews/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unknownUuid,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import { worktreeNotFound, worktreePath } from '../scripts/fixture.ts';

const comments = (session: Session, suffix = '') =>
  worktreePath(session, `/comments${suffix}`);
const targetNotFound = apiError(404, 'Not Found', 'Comment target not found');
const fileAnchor = { kind: 'file', filePath: 'README.md' } as const;
const threadId = randomUUID();
const messageId = randomUUID();

function thread(value: unknown, id: string) {
  const found = list(value).find((entry) => record(entry).id === id);
  if (!found) throw new Error(`Thread ${id} is not listed`);
  return record(found);
}

export default defineFeature({
  feature: 'reviews.comment-threads',
  reaches: [
    'GET /api/worktrees/:worktreeId/comments',
    'POST /api/worktrees/:worktreeId/comments',
    'POST /api/worktrees/:worktreeId/comments/:threadId/replies',
    'PUT /api/worktrees/:worktreeId/comments/:threadId/resolution',
  ],
  intent: 'intended',
  behaviour:
    "A reviewer discusses a worktree's change in comment threads anchored to a file or a line range (optionally to one comparison). Every write answers with a one-element list holding the thread it wrote (the contract types it as exactly one thread, not as the thread list), and bumps the worktree's comment revision; a paired viewer writes as the reviewer. Clients may choose thread and message IDs so a retried write is recognised: repeating it changes nothing, reusing an ID for different content is a conflict. Replies and resolution changes address an existing thread; an unknown one is not found. Anchors are not checked against the files.",
  cases: [
    defineCase({
      name: 'no threads yet',
      request: (session) => ({ method: 'GET', path: comments(session) }),
      expect({ response, check, checkContract }) {
        check('status', 200, response.status);
        check('body', [], response.body);
        checkContract(
          'contract',
          listCommentThreadsResponseSchema,
          response.body,
        );
      },
    }),
    defineCase({
      name: 'create file and line-range threads',
      request: (session) => [
        {
          method: 'POST',
          path: comments(session),
          body: { threadId, messageId, anchor: fileAnchor, body: 'Looks good' },
        },
        {
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
        },
      ],
      async expect({ responses, session, check, checkPartial, checkContract }) {
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        checkContract(
          'contract',
          createCommentThreadResponseSchema,
          responses[1]?.body,
        );
        checkPartial(
          'file thread',
          {
            id: threadId,
            worktreeId: session.worktreeId,
            anchor: fileAnchor,
            resolved: false,
            messages: [
              { id: messageId, body: 'Looks good', author: 'reviewer' },
            ],
            revision: 1,
          },
          thread(responses[0]?.body, threadId),
        );
        check(
          'a write answers only its own thread',
          [1, 1],
          responses.map((entry) => list(entry.body).length),
        );
        const listed = await session.send({
          method: 'GET',
          path: comments(session),
        });
        check(
          'list holds both written threads',
          [...list(responses[0]?.body), ...list(responses[1]?.body)],
          listed.body,
        );
        check(
          'revisions',
          [1, 2],
          list(listed.body)
            .map((entry) => Number(record(entry).revision))
            .sort((left, right) => left - right),
        );
      },
    }),
    defineCase({
      name: 'retried create and conflicting reuse of IDs',
      request: (session) => [
        {
          method: 'POST',
          path: comments(session),
          body: { threadId, messageId, anchor: fileAnchor, body: 'Looks good' },
        },
        {
          method: 'POST',
          path: comments(session),
          body: {
            threadId,
            messageId,
            anchor: fileAnchor,
            body: 'Something else',
          },
        },
      ],
      async expect({ responses, session, check }) {
        check('retry status', 200, responses[0]?.status);
        check(
          'retry answers the original thread',
          1,
          thread(responses[0]?.body, threadId).revision,
        );
        check(
          'retry creates nothing',
          2,
          list(
            (await session.send({ method: 'GET', path: comments(session) }))
              .body,
          ).length,
        );
        check('conflict status', 409, responses[1]?.status);
        check(
          'conflict error body',
          apiError(409, 'Conflict', 'Comment ID belongs to a different write'),
          responses[1]?.body,
        );
      },
    }),
    defineCase({
      name: 'reply and resolve',
      request: (session) => [
        {
          method: 'POST',
          path: comments(session, `/${threadId}/replies`),
          body: { body: 'Thanks' },
        },
        {
          method: 'PUT',
          path: comments(session, `/${threadId}/resolution`),
          body: { resolved: true },
        },
      ],
      expect({ responses, check, checkPartial, checkContract }) {
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        checkContract(
          'reply contract',
          replyToCommentResponseSchema,
          responses[0]?.body,
        );
        checkContract(
          'resolution contract',
          resolveCommentThreadResponseSchema,
          responses[1]?.body,
        );
        checkPartial(
          'reply is appended',
          {
            resolved: false,
            messages: [
              { body: 'Looks good' },
              { body: 'Thanks', author: 'reviewer' },
            ],
            revision: 3,
          },
          thread(responses[0]?.body, threadId),
        );
        checkPartial(
          'thread is resolved',
          { resolved: true, revision: 4 },
          thread(responses[1]?.body, threadId),
        );
      },
    }),
    defineCase({
      name: 'an anchor on a file that does not exist',
      request: (session) => ({
        method: 'POST',
        path: comments(session),
        body: {
          anchor: { kind: 'file', filePath: 'missing.md' },
          body: 'Where?',
        },
      }),
      expect({ response, check }) {
        check('status', 200, response.status);
        check(
          'is accepted',
          true,
          list(response.body).some(
            (entry) => record(record(entry).anchor).filePath === 'missing.md',
          ),
        );
      },
    }),
    defineCase({
      name: 'unknown thread',
      request: (session) => [
        {
          method: 'POST',
          path: comments(session, `/${unknownUuid}/replies`),
          body: { body: 'Hello?' },
        },
        {
          method: 'PUT',
          path: comments(session, `/${unknownUuid}/resolution`),
          body: { resolved: true },
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 404, response.status);
          check(
            `request ${index + 1} error body`,
            targetNotFound,
            response.body,
          );
        }
      },
    }),
    defineCase({
      name: 'invalid input',
      request: (session) => [
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
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 400, response.status);
          check(
            `request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
      },
    }),
    defineCase({
      name: 'unknown worktree',
      request: () => [
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
      ],
      expect({ responses, check }) {
        check(
          'statuses',
          [404, 404, 404, 404],
          responses.map((entry) => entry.status),
        );
        check('list error body', worktreeNotFound, responses[0]?.body);
        check('create error body', worktreeNotFound, responses[1]?.body);
        check('reply error body', worktreeNotFound, responses[2]?.body);
        check('resolve error body', worktreeNotFound, responses[3]?.body);
      },
    }),
  ],
});
