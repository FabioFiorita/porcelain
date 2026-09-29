import { randomUUID } from 'node:crypto';
import { deleteResolvedCommentsResponseSchema } from '@porcelain/contracts/reviews';
import {
  defineCase,
  defineFeature,
  invalidRequest,
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
) => ({
  method: 'POST' as const,
  path: `/api/worktrees/${worktree}/comments/resolved/deletion`,
  body: { threads },
});

export default defineFeature({
  feature: 'reviews.delete-resolved-comments',
  reaches: 'POST /api/worktrees/:worktreeId/comments/resolved/deletion',
  paired: true,
  intent: 'intended',
  behaviour:
    "A reviewer deletes the resolved comment threads they confirmed, naming each with the revision they saw. A thread belongs to whoever started it: a confirmed resolved thread the reviewer started is deleted whole, the agent's replies in it included, while a thread the agent started is never deleted by the reviewer. A confirmed thread that changed since, because the agent replied or it was reopened, is kept, and so is one that is open, gone or in another worktree; the answer names the deleted threads and the skipped ones. A deleted thread no longer reaches the agent through the review tools, and an unknown worktree is not found.",
  cases: [
    defineCase({
      name: "the reviewer's confirmed resolved threads go, a thread the agent answered since stays",
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
        return confirmed;
      },
      request: (session, confirmed) => deleteResolved(session, confirmed),
      async expect({ response, session, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          deleteResolvedCommentsResponseSchema,
          response.body,
        );
        check(
          'the deleted and the skipped threads',
          { deleted: [answeredId], skipped: [notedId, fromAgentId, openId] },
          response.body,
        );
        check(
          'the reviewer reads the kept threads',
          [notedId, openId, fromAgentId],
          await threads(session),
        );
        const listed = await read(
          session,
          toolCall(session, 4, 'list_comments', { scope: 'all' }),
        );
        checkPartial('a tool answer', answered(4), listed);
        check(
          'the agent no longer reads the deleted thread',
          [notedId, openId, fromAgentId],
          list(toolValue(listed)).map((entry) => record(entry).id),
        );
      },
    }),
    defineCase({
      name: 'a second request deletes nothing, an empty or malformed list is invalid and an unknown worktree is not found',
      request: (session) => [
        deleteResolved(session, [{ threadId: answeredId, revision: 1 }]),
        deleteResolved(session, []),
        deleteResolved(session, [{ threadId: answeredId }]),
        deleteResolved(
          session,
          [{ threadId: answeredId, revision: 1 }],
          unknownWorktreeId,
        ),
      ],
      async expect({ responses, session, check }) {
        check(
          'statuses',
          [200, 400, 400, 404],
          responses.map((entry) => entry.status),
        );
        check(
          'nothing deleted',
          { deleted: [], skipped: [answeredId] },
          responses[0]?.body,
        );
        check('empty', invalidRequest, responses[1]?.body);
        check('malformed', invalidRequest, responses[2]?.body);
        check('unknown worktree', worktreeNotFound, responses[3]?.body);
        check(
          'the threads are unchanged',
          [notedId, openId, fromAgentId],
          await threads(session),
        );
      },
    }),
  ],
});
