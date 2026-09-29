import { randomUUID } from 'node:crypto';
import {
  deleteCommentMessageResponseSchema,
  editCommentMessageResponseSchema,
} from '@porcelain/contracts/reviews';
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
import {
  read,
  toolCall,
  toolValue,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const threadId = randomUUID();
const questionId = randomUUID();
const answerId = randomUUID();
const followUpId = randomUUID();
const loneThreadId = randomUUID();
const loneMessageId = randomUUID();
const question = 'Why this line?';
const rewritten = 'Why does this line change the heading?';
const answer = 'It names the new section.';
const targetNotFound = apiError(404, 'Not Found', 'Comment target not found');
const notTheAuthor = apiError(
  403,
  'Forbidden',
  'Only the author of a comment may change it',
);
const answered = (id: number) => ({
  jsonrpc: '2.0',
  id,
  result: { content: [{ type: 'text' }] },
});
const message = (session: Session, thread: string, id: string) =>
  worktreePath(session, `/comments/${thread}/messages/${id}`);
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

export default defineFeature({
  feature: 'reviews.edit-comments',
  reaches: [
    'PATCH /api/worktrees/:worktreeId/comments/:threadId/messages/:messageId',
    'DELETE /api/worktrees/:worktreeId/comments/:threadId/messages/:messageId',
    'owner POST /mcp',
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    "A reviewer rewrites or deletes a message they wrote in a comment thread. Only the message's author may change it: a paired viewer or the owner writes as the reviewer, the review tools as the agent, and a reviewer cannot change the agent's messages. A rewrite keeps the message in its place, stamps when it was edited and moves the thread to the next comment revision; the same text changes nothing. A deletion removes the one message, keeps the rest of the thread at the next revision and removes the thread with its last message. The agent reads the current text through the review tools, and a deleted message or thread no longer reaches it. An unknown thread or message is not found.",
  cases: [
    defineCase({
      name: 'the reviewer rewrites their comment and the agent reads the new text',
      async setup(session) {
        await read(session, {
          method: 'POST',
          path: worktreePath(session, '/comments'),
          body: {
            threadId,
            messageId: questionId,
            anchor: { kind: 'file', filePath: 'README.md' },
            body: question,
          },
        });
        await read(
          session,
          toolCall(session, 1, 'reply_to_comment', {
            threadId,
            messageId: answerId,
            body: answer,
          }),
        );
        return record(await threadOf(session, threadId));
      },
      request: (session) => [
        {
          method: 'PATCH',
          path: message(session, threadId, questionId),
          body: { body: rewritten },
        },
        toolCall(session, 2, 'list_comments', { scope: 'all' }),
      ],
      expect({
        responses,
        state,
        check,
        checkPartial,
        checkContract,
        checkMatch,
      }) {
        check('status', 200, responses[0]?.status);
        checkContract(
          'contract',
          editCommentMessageResponseSchema,
          responses[0]?.body,
        );
        checkPartial(
          'the message is rewritten in its place',
          {
            id: threadId,
            messages: [
              { id: questionId, body: rewritten, author: 'reviewer' },
              { id: answerId, body: answer, author: 'agent' },
            ],
            revision: Number(state.revision) + 1,
          },
          responses[0]?.body,
        );
        checkMatch(
          'the edit is stamped',
          /^\d{4}-\d{2}-\d{2}T/,
          String(record(list(record(responses[0]?.body).messages)[0]).editedAt),
        );
        check('tool status', 200, responses[1]?.status);
        checkPartial('a tool answer', answered(2), responses[1]?.body);
        checkPartial(
          'the agent reads the new text',
          [
            {
              id: threadId,
              messages: [
                { id: questionId, body: rewritten },
                { id: answerId, body: answer },
              ],
            },
          ],
          toolValue(responses[1]?.body),
        );
      },
    }),
    defineCase({
      name: 'the same text changes nothing',
      setup: async (session) => record(await threadOf(session, threadId)),
      request: (session) => ({
        method: 'PATCH',
        path: message(session, threadId, questionId),
        body: { body: rewritten },
      }),
      expect({ response, state, check }) {
        check('status', 200, response.status);
        check('the thread as it was', state, response.body);
      },
    }),
    defineCase({
      name: "a reviewer cannot change the agent's message",
      setup: async (session) => record(await threadOf(session, threadId)),
      request: (session) => [
        {
          method: 'PATCH',
          path: message(session, threadId, answerId),
          body: { body: 'Rewritten by someone else' },
        },
        { method: 'DELETE', path: message(session, threadId, answerId) },
      ],
      async expect({ responses, state, session, check }) {
        check(
          'statuses',
          [403, 403],
          responses.map((entry) => entry.status),
        );
        check('edit error body', notTheAuthor, responses[0]?.body);
        check('delete error body', notTheAuthor, responses[1]?.body);
        check(
          'the thread is unchanged',
          state,
          await threadOf(session, threadId),
        );
      },
    }),
    defineCase({
      name: 'the reviewer deletes a reply and the rest of the thread stays',
      async setup(session) {
        await read(session, {
          method: 'POST',
          path: worktreePath(session, `/comments/${threadId}/replies`),
          body: { messageId: followUpId, body: 'Thanks' },
        });
        return record(await threadOf(session, threadId));
      },
      request: (session) => ({
        method: 'DELETE',
        path: message(session, threadId, followUpId),
      }),
      async expect({
        response,
        state,
        session,
        check,
        checkPartial,
        checkContract,
      }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          deleteCommentMessageResponseSchema,
          response.body,
        );
        checkPartial(
          'the thread without the reply',
          {
            threadId,
            thread: {
              id: threadId,
              messages: [
                { id: questionId, body: rewritten },
                { id: answerId, body: answer },
              ],
              revision: Number(state.revision) + 1,
            },
          },
          response.body,
        );
        check(
          'the list holds the same thread',
          record(response.body).thread,
          await threadOf(session, threadId),
        );
      },
    }),
    defineCase({
      name: 'deleting the last message removes the thread for the agent too',
      async setup(session) {
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
      },
      request: (session) => [
        {
          method: 'DELETE',
          path: message(session, loneThreadId, loneMessageId),
        },
        toolCall(session, 3, 'list_comments', { scope: 'all' }),
      ],
      async expect({ responses, session, check, checkPartial }) {
        check('status', 200, responses[0]?.status);
        check(
          'no thread is left',
          { threadId: loneThreadId, thread: null },
          responses[0]?.body,
        );
        check('tool status', 200, responses[1]?.status);
        checkPartial('a tool answer', answered(3), responses[1]?.body);
        check(
          'the agent reads only the other thread',
          [threadId],
          list(toolValue(responses[1]?.body)).map((entry) => record(entry).id),
        );
        check(
          'the reviewer reads only the other thread',
          [threadId],
          (await threads(session)).map((entry) => record(entry).id),
        );
      },
    }),
    defineCase({
      name: 'invalid text, unknown messages and unknown worktrees',
      request: (session) => [
        {
          method: 'PATCH',
          path: message(session, threadId, questionId),
          body: { body: '   ' },
        },
        {
          method: 'PATCH',
          path: message(session, threadId, unknownUuid),
          body: { body: 'Hello' },
        },
        { method: 'DELETE', path: message(session, unknownUuid, questionId) },
        {
          method: 'DELETE',
          path: message(session, loneThreadId, loneMessageId),
        },
        {
          method: 'PATCH',
          path: `/api/worktrees/${unknownWorktreeId}/comments/${threadId}/messages/${questionId}`,
          body: { body: 'Hello' },
        },
      ],
      expect({ responses, check }) {
        check(
          'statuses',
          [400, 404, 404, 404, 404],
          responses.map((entry) => entry.status),
        );
        check('blank text', invalidRequest, responses[0]?.body);
        check('unknown message', targetNotFound, responses[1]?.body);
        check('unknown thread', targetNotFound, responses[2]?.body);
        check('deleted thread', targetNotFound, responses[3]?.body);
        check('unknown worktree', worktreeNotFound, responses[4]?.body);
      },
    }),
  ],
});
