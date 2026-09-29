import { randomUUID } from 'node:crypto';
import { createCommentThreadResponseSchema } from '@porcelain/contracts/reviews';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  text,
} from '../scripts/feature.ts';
import {
  head,
  read,
  toolCall,
  toolValue,
  worktreePath,
} from '../scripts/fixture.ts';

const base = 'refs/heads/main';
const changeThreadId = randomUUID();
const branchThreadId = randomUUID();
const agentThreadId = randomUUID();
const answered = (id: number) => ({
  jsonrpc: '2.0',
  id,
  result: { content: [{ type: 'text' }] },
});

export default defineFeature({
  feature: 'reviews.change-comments',
  reaches: ['POST /api/worktrees/:worktreeId/comments', 'owner POST /mcp'],
  paired: true,
  intent: 'intended',
  behaviour:
    'A reviewer comments on a whole change instead of one file: the uncommitted change of the worktree, or the checked-out branch compared against a base at the tip it was read at. The coding agent reads such a thread through the review tools with the same anchor and can open one itself. A whole-change comment names no file, compares against nothing but a branch, and a branch comparison must name its tip; anything else is refused.',
  cases: [
    defineCase({
      name: 'the agent reads a comment on the whole uncommitted change',
      async setup(session) {
        await read(session, {
          method: 'POST',
          path: worktreePath(session, '/comments'),
          body: {
            threadId: changeThreadId,
            anchor: { kind: 'change' },
            body: 'Split this into two commits.',
          },
        });
      },
      request: (session) => toolCall(session, 1, 'list_comments', {}),
      expect({ response, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial('a tool answer', answered(1), response.body);
        check(
          'the thread on the whole change',
          [
            {
              id: changeThreadId,
              anchor: { kind: 'change' },
              body: 'Split this into two commits.',
              author: 'reviewer',
            },
          ],
          list(toolValue(response.body)).map((entry) => ({
            id: record(entry).id,
            anchor: record(entry).anchor,
            body: record(list(record(entry).messages)[0]).body,
            author: record(list(record(entry).messages)[0]).author,
          })),
        );
      },
    }),
    defineCase({
      name: 'a comment on the whole branch names its base and tip',
      async setup(session) {
        await session.git('switch', '-c', 'feature');
        await session.writeFile('notes.md', 'first\n');
        await session.git('add', 'notes.md');
        await session.git('commit', '-m', 'Add notes');
        return head(session);
      },
      request: (session, tip) => [
        {
          method: 'POST',
          path: worktreePath(session, '/comments'),
          body: {
            threadId: branchThreadId,
            anchor: {
              kind: 'change',
              comparison: { kind: 'branch', base },
              revision: tip,
            },
            body: 'Ready to merge?',
          },
        },
        toolCall(session, 2, 'list_comments', {}),
      ],
      expect({ responses, state, check, checkPartial, checkContract }) {
        check('status', 200, responses[0]?.status);
        checkContract(
          'contract',
          createCommentThreadResponseSchema,
          responses[0]?.body,
        );
        checkPartial(
          'the thread on the whole branch',
          {
            id: branchThreadId,
            anchor: {
              kind: 'change',
              comparison: { kind: 'branch', base },
              revision: state,
            },
            messages: [{ body: 'Ready to merge?', author: 'reviewer' }],
          },
          responses[0]?.body,
        );
        check('tool status', 200, responses[1]?.status);
        checkPartial('a tool answer', answered(2), responses[1]?.body);
        checkPartial(
          'the agent reads both threads',
          [
            { id: changeThreadId, anchor: { kind: 'change' } },
            {
              id: branchThreadId,
              anchor: {
                kind: 'change',
                comparison: { kind: 'branch', base },
                revision: state,
              },
            },
          ],
          toolValue(responses[1]?.body),
        );
      },
    }),
    defineCase({
      name: 'the agent comments on the whole change',
      request: (session) =>
        toolCall(session, 3, 'create_comment', {
          threadId: agentThreadId,
          anchor: { kind: 'change' },
          body: 'I left the migration for a follow-up.',
        }),
      async expect({ response, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial('a tool answer', answered(3), response.body);
        checkPartial(
          'the agent thread',
          {
            id: agentThreadId,
            anchor: { kind: 'change' },
            messages: [{ author: 'agent' }],
          },
          toolValue(response.body),
        );
        const threads = list(
          (
            await session.read({
              method: 'GET',
              path: worktreePath(session, '/comments'),
            })
          ).body,
        );
        check(
          'the reviewer reads it',
          [changeThreadId, branchThreadId, agentThreadId],
          threads.map((entry) => text(record(entry).id)),
        );
      },
    }),
    defineCase({
      name: 'a whole-change comment with a file, another comparison or no tip',
      setup: head,
      request: (session, tip) =>
        [
          { kind: 'change', filePath: 'README.md' },
          { kind: 'change', comparison: { kind: 'worktree', scope: 'staged' } },
          {
            kind: 'change',
            comparison: { kind: 'commit', parent: 1 },
            revision: tip,
          },
          { kind: 'change', comparison: { kind: 'branch', base } },
        ].map((anchor) => ({
          method: 'POST',
          path: worktreePath(session, '/comments'),
          body: { anchor, body: 'Refused' },
        })),
      async expect({ responses, session, check }) {
        check(
          'statuses',
          [400, 400, 400, 400],
          responses.map((entry) => entry.status),
        );
        for (const [index, response] of responses.entries())
          check(
            `request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        check(
          'nothing was written',
          3,
          list(
            (
              await session.read({
                method: 'GET',
                path: worktreePath(session, '/comments'),
              })
            ).body,
          ).length,
        );
      },
    }),
  ],
});
