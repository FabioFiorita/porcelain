import { seedAgentComment } from '../kit/seed-agent-comment.ts';
import { expect } from 'vitest';
import { invalidRequest } from '../kit/answers.ts';
import { head } from '../kit/reads.ts';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, type HttpResponse } from '../kit/session.ts';

const BASE = 'refs/heads/main';

test('whole-change and branch comments keep their anchors and stored agent authorship', async ({
  session,
}) => {
  const created = await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: { anchor: { kind: 'change' }, body: 'Split this into two commits.' },
  });
  await session.git('switch', '-c', 'feature');
  await session.writeFile('notes.md', 'first\n');
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Add notes');
  const tip = await head(session);
  const branch = await read(session, {
    method: 'POST',
    path: worktreePath(session, '/comments'),
    body: {
      anchor: {
        kind: 'change',
        comparison: { kind: 'branch', base: BASE },
        revision: tip,
      },
      body: 'Ready to merge?',
    },
  });
  const agent = await seedAgentComment(session, {
    anchor: { kind: 'change' },
    body: 'I left the migration for a follow-up.',
  });
  const stored = list(
    (
      await session.read({
        method: 'GET',
        path: worktreePath(session, '/comments'),
      })
    ).body,
  );
  expect(stored).toMatchObject([
    {
      id: created.id,
      anchor: { kind: 'change' },
      messages: [{ author: 'reviewer', body: 'Split this into two commits.' }],
    },
    {
      id: branch.id,
      anchor: {
        kind: 'change',
        comparison: { kind: 'branch', base: BASE },
        revision: tip,
      },
      messages: [{ author: 'reviewer', body: 'Ready to merge?' }],
    },
    {
      id: agent.id,
      anchor: { kind: 'change' },
      messages: [
        { author: 'agent', body: 'I left the migration for a follow-up.' },
      ],
    },
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
