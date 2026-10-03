import { randomUUID } from 'node:crypto';
import { createCommentThreadResponseSchema } from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import { invalidRequest } from '../kit/answers.ts';
import { head } from '../kit/reads.ts';
import {
  read,
  toolCall,
  toolValue,
  worktreePath,
  answered,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text, type HttpResponse } from '../kit/session.ts';

const BASE = 'refs/heads/main';
const changeThreadId = randomUUID();
const branchThreadId = randomUUID();
const agentThreadId = randomUUID();

test('the agent reads a reviewer comment on the whole uncommitted change', async ({
  session,
}) => {
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      threadId: changeThreadId,
      anchor: { kind: 'change' },
      body: 'Split this into two commits.',
    },
  });

  const response = await session.send(
    toolCall(session, 1, 'list_comments', {}),
  );

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject(answered(1));
  expect(
    list(toolValue(response.body)).map((entry) => ({
      id: record(entry).id,
      anchor: record(entry).anchor,
      body: record(list(record(entry).messages)[0]).body,
      author: record(list(record(entry).messages)[0]).author,
    })),
  ).toStrictEqual([
    {
      id: changeThreadId,
      anchor: { kind: 'change' },
      body: 'Split this into two commits.',
      author: 'reviewer',
    },
  ]);
});

test('a reviewer comment on the whole branch names its base and tip and reaches the agent', async ({
  session,
}) => {
  await session.git('switch', '-c', 'feature');
  await session.writeFile('notes.md', 'first\n');
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Add notes');
  const tip = await head(session);

  const created = await session.send({
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      threadId: branchThreadId,
      anchor: {
        kind: 'change',
        comparison: { kind: 'branch', base: BASE },
        revision: tip,
      },
      body: 'Ready to merge?',
    },
  });
  const listed = await session.send(toolCall(session, 2, 'list_comments', {}));

  expect(created.status).toBe(200);
  expect(created.body).toEqual(
    expect.schemaMatching(createCommentThreadResponseSchema),
  );
  expect(created.body).toMatchObject({
    id: branchThreadId,
    anchor: {
      kind: 'change',
      comparison: { kind: 'branch', base: BASE },
      revision: tip,
    },
    messages: [{ body: 'Ready to merge?', author: 'reviewer' }],
  });
  expect(listed.status).toBe(200);
  expect(listed.body).toMatchObject(answered(2));
  expect(toolValue(listed.body)).toMatchObject([
    { id: changeThreadId, anchor: { kind: 'change' } },
    {
      id: branchThreadId,
      anchor: {
        kind: 'change',
        comparison: { kind: 'branch', base: BASE },
        revision: tip,
      },
    },
  ]);
});

test('the agent opens a comment on the whole change and the reviewer reads it', async ({
  session,
}) => {
  const response = await session.send(
    toolCall(session, 3, 'create_comment', {
      threadId: agentThreadId,
      anchor: { kind: 'change' },
      body: 'I left the migration for a follow-up.',
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject(answered(3));
  expect(toolValue(response.body)).toMatchObject({
    id: agentThreadId,
    anchor: { kind: 'change' },
    messages: [{ author: 'agent' }],
  });
  const threads = list(
    (
      await session.read({
        method: 'GET',
        path: worktreePath(session, '/comments'),
      })
    ).body,
  );
  expect(threads.map((entry) => text(record(entry).id))).toStrictEqual([
    changeThreadId,
    branchThreadId,
    agentThreadId,
  ]);
});

test('a whole-change comment that names a file, compares against anything but a branch, or omits the branch tip is refused and nothing is written', async ({
  session,
}) => {
  const tip = await head(session);
  const responses: HttpResponse[] = [];

  for (const anchor of [
    { kind: 'change', filePath: 'README.md' },
    { kind: 'change', comparison: { kind: 'worktree', scope: 'staged' } },
    {
      kind: 'change',
      comparison: { kind: 'commit', parent: 1 },
      revision: tip,
    },
    { kind: 'change', comparison: { kind: 'branch', base: BASE } },
  ])
    responses.push(
      await session.send({
        method: 'POST',
        path: worktreePath(session, '/comments'),
        body: { anchor, body: 'Refused' },
      }),
    );

  expect(responses.map((entry) => entry.status)).toStrictEqual([
    400, 400, 400, 400,
  ]);
  for (const response of responses)
    expect(response.body).toStrictEqual(invalidRequest);
  expect(
    list(
      (
        await session.read({
          method: 'GET',
          path: worktreePath(session, '/comments'),
        })
      ).body,
    ),
  ).toHaveLength(3);
});
