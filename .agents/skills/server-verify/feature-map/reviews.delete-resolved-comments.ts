import { randomUUID } from 'node:crypto';
import { deleteResolvedCommentsResponseSchema } from '@porcelain/contracts/reviews';
import {
  defineCase,
  defineFeature,
  list,
  record,
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

const answeredId = randomUUID();
const notedId = randomUUID();
const openId = randomUUID();
const fromAgentId = randomUUID();
const answered = (id: number) => ({
  jsonrpc: '2.0',
  id,
  result: { content: [{ type: 'text' }] },
});
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
const deleteResolved = (session: Session) => ({
  method: 'DELETE' as const,
  path: worktreePath(session, '/comments/resolved'),
});

export default defineFeature({
  feature: 'reviews.delete-resolved-comments',
  reaches: 'DELETE /api/worktrees/:worktreeId/comments/resolved',
  paired: true,
  intent: 'intended',
  behaviour:
    "A reviewer clears the resolved comments of a worktree in one request. A thread belongs to whoever started it: every resolved thread the reviewer started is deleted whole, the agent's replies in it included, while a resolved thread the agent started is kept and counted, since a reviewer never deletes what the agent wrote on its own. Open threads stay. The answer names the deleted threads and counts the kept ones, a deleted thread no longer reaches the agent through the review tools, a second request deletes nothing, and an unknown worktree is not found.",
  cases: [
    defineCase({
      name: "the reviewer's resolved threads go, the agent's resolved thread and the open one stay",
      async setup(session) {
        for (const [threadId, body] of [
          [answeredId, 'Why this heading?'],
          [notedId, 'Note to self'],
          [openId, 'Still open'],
        ] as const)
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
      },
      request: deleteResolved,
      async expect({ response, session, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          deleteResolvedCommentsResponseSchema,
          response.body,
        );
        check(
          'the deleted threads and the kept count',
          { deleted: [answeredId, notedId], kept: 1 },
          response.body,
        );
        check(
          'the reviewer reads the open thread and the agent one',
          [openId, fromAgentId],
          await threads(session),
        );
        const listed = await read(
          session,
          toolCall(session, 3, 'list_comments', { scope: 'all' }),
        );
        checkPartial('a tool answer', answered(3), listed);
        check(
          'the agent no longer reads the deleted threads',
          [openId, fromAgentId],
          list(toolValue(listed)).map((entry) => record(entry).id),
        );
      },
    }),
    defineCase({
      name: 'a second request deletes nothing and an unknown worktree is not found',
      request: (session) => [
        deleteResolved(session),
        {
          method: 'DELETE',
          path: `/api/worktrees/${unknownWorktreeId}/comments/resolved`,
        },
      ],
      async expect({ responses, session, check }) {
        check(
          'statuses',
          [200, 404],
          responses.map((entry) => entry.status),
        );
        check('nothing deleted', { deleted: [], kept: 1 }, responses[0]?.body);
        check('unknown worktree', worktreeNotFound, responses[1]?.body);
        check(
          'the threads are unchanged',
          [openId, fromAgentId],
          await threads(session),
        );
      },
    }),
  ],
});
