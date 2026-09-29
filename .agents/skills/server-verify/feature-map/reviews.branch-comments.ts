import { randomUUID } from 'node:crypto';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  text,
  type Session,
} from '../scripts/feature.ts';
import {
  head,
  read,
  toolCall,
  toolValue,
  worktreePath,
} from '../scripts/fixture.ts';

const base = 'refs/heads/main';
const threadId = randomUUID();
const agentThreadId = randomUUID();
const answered = (id: number) => ({
  jsonrpc: '2.0',
  id,
  result: { content: [{ type: 'text' }] },
});

async function branchNotes(session: Session) {
  const body = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/branch-changes'),
  });
  const notes = list(body.files).find(
    (entry) => record(entry).path === 'notes.md',
  );
  return {
    tip: text(record(body.head).oid),
    fingerprint: text(record(notes).fingerprint),
  };
}

export default defineFeature({
  feature: 'reviews.branch-comments',
  reaches: 'owner POST /mcp',
  paired: false,
  intent: 'intended',
  behaviour:
    "A reviewer's comment on a line of the branch review reaches the coding agent through the review tools with the base it was compared against, the branch tip it was read at and the side of the line, and the agent can answer on the branch comparison the same way. A branch comparison that does not name the tip it was read at is refused.",
  cases: [
    defineCase({
      name: "the agent reads the reviewer's branch comment",
      async setup(session) {
        await session.git('switch', '-c', 'feature');
        await session.writeFile('notes.md', 'first\nsecond\n');
        await session.git('add', 'notes.md');
        await session.git('commit', '-m', 'Add notes');
        const notes = await branchNotes(session);
        const anchor = {
          kind: 'codeRange',
          filePath: 'notes.md',
          startLine: 2,
          endLine: 2,
          side: 'additions',
          comparison: { kind: 'branch', base },
          revision: notes.tip,
          contentFingerprint: notes.fingerprint,
        };
        await read(session, {
          method: 'POST',
          path: worktreePath(session, '/comments'),
          body: { threadId, anchor, body: 'Why a second line?' },
        });
        return anchor;
      },
      request: (session) => toolCall(session, 1, 'list_comments', {}),
      expect({ response, state, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial('a tool answer', answered(1), response.body);
        checkPartial(
          'the thread waiting for the agent, anchored to the branch',
          [
            {
              id: threadId,
              anchor: state,
              messages: [{ body: 'Why a second line?', author: 'reviewer' }],
            },
          ],
          toolValue(response.body),
        );
      },
    }),
    defineCase({
      name: 'the agent comments on the branch comparison',
      setup: head,
      request: (session, tip) => [
        toolCall(session, 2, 'create_comment', {
          threadId: agentThreadId,
          anchor: {
            kind: 'file',
            filePath: 'notes.md',
            comparison: { kind: 'branch', base },
            revision: tip,
          },
          body: 'Split this file before merging.',
        }),
        toolCall(session, 3, 'create_comment', {
          anchor: {
            kind: 'file',
            filePath: 'notes.md',
            comparison: { kind: 'branch', base },
          },
          body: 'Missing its tip',
        }),
      ],
      expect({ responses, state, check, checkPartial }) {
        check('created status', 200, responses[0]?.status);
        checkPartial('a tool answer', answered(2), responses[0]?.body);
        checkPartial(
          'the agent thread on the branch',
          {
            id: agentThreadId,
            anchor: {
              kind: 'file',
              filePath: 'notes.md',
              comparison: { kind: 'branch', base },
              revision: state,
            },
            messages: [{ author: 'agent' }],
          },
          toolValue(responses[0]?.body),
        );
        check('refused status', 200, responses[1]?.status);
        checkPartial(
          'a tool error',
          { result: { isError: true } },
          responses[1]?.body,
        );
        check(
          'refused error body',
          invalidRequest,
          toolValue(responses[1]?.body),
        );
      },
    }),
  ],
});
