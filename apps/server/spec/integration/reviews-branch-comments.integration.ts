import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { invalidRequest } from '../kit/answers.ts';
import { head } from '../kit/reads.ts';
import { read, toolCall, toolValue, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text, type Session } from '../kit/session.ts';

const BASE = 'refs/heads/main';
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

test("the agent reads the reviewer's comment on a branch line with its base, tip and side", async ({
  session,
}) => {
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
    comparison: { kind: 'branch', base: BASE },
    revision: notes.tip,
    contentFingerprint: notes.fingerprint,
  };
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: { threadId, anchor, body: 'Why a second line?' },
  });

  const response = await session.send(
    toolCall(session, 1, 'list_comments', {}),
  );

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject(answered(1));
  expect(toolValue(response.body)).toMatchObject([
    {
      id: threadId,
      anchor,
      messages: [{ body: 'Why a second line?', author: 'reviewer' }],
    },
  ]);
});

test('the agent comments on the branch comparison at its tip, and a branch comparison without a tip is refused', async ({
  session,
}) => {
  const tip = await head(session);

  const created = await session.send(
    toolCall(session, 2, 'create_comment', {
      threadId: agentThreadId,
      anchor: {
        kind: 'file',
        filePath: 'notes.md',
        comparison: { kind: 'branch', base: BASE },
        revision: tip,
      },
      body: 'Split this file before merging.',
    }),
  );
  const refused = await session.send(
    toolCall(session, 3, 'create_comment', {
      anchor: {
        kind: 'file',
        filePath: 'notes.md',
        comparison: { kind: 'branch', base: BASE },
      },
      body: 'Missing its tip',
    }),
  );

  expect(created.status).toBe(200);
  expect(created.body).toMatchObject(answered(2));
  expect(toolValue(created.body)).toMatchObject({
    id: agentThreadId,
    anchor: {
      kind: 'file',
      filePath: 'notes.md',
      comparison: { kind: 'branch', base: BASE },
      revision: tip,
    },
    messages: [{ author: 'agent' }],
  });
  expect(refused.status).toBe(200);
  expect(refused.body).toMatchObject({ result: { isError: true } });
  expect(toolValue(refused.body)).toStrictEqual(invalidRequest);
});
