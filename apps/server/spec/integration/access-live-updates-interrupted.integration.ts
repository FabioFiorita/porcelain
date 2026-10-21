import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { expectation, fingerprintOf, watching } from '../kit/reads.ts';
import { gitPath } from '../kit/requests.ts';
import { gitInterruptionTest as it } from '../kit/server-test.ts';
import { record, type Session } from '../kit/session.ts';

const HEAD_REFLOG = '.git/logs/HEAD';

const worktreeNotice = (session: Session, change: string) => ({
  type: 'worktree',
  projectId: session.projectId,
  worktreeId: session.worktreeId,
  change,
});
const isWorktree = (change: string) => (notice: Record<string, unknown>) =>
  notice.type === 'worktree' && notice.change === change;

it('watching never opens a reflog, so a commit whose reflog is a named pipe ends interrupted and later Git changes are still announced', async ({
  session,
}) => {
  const connection = await watching(session);
  await session.remove(HEAD_REFLOG);
  await session.fifo(HEAD_REFLOG);
  const path = 'piped.md';
  await session.writeFile(path, 'Piped\n');
  const requestId = randomUUID();
  const expected = {
    ...(await expectation(session)),
    files: [{ path, fingerprint: await fingerprintOf(session, path) }],
  };

  const response = await session.send({
    method: 'POST',
    path: gitPath(session, '/actions'),
    body: {
      requestId,
      input: { action: 'commit', message: 'Piped', paths: [path] },
      expected,
    },
  });

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({ requestId, state: 'running' });
  expect(
    await connection.next(
      (entry) =>
        entry.type === 'git-action' &&
        record(entry.receipt).state !== 'running',
    ),
  ).toMatchObject({
    type: 'git-action',
    receipt: { requestId, state: 'interrupted' },
  });
  await session.git('branch', 'after-the-pipe');
  expect(await connection.next(isWorktree('git'))).toStrictEqual(
    worktreeNotice(session, 'git'),
  );
  await session.remove(HEAD_REFLOG);
  await session.remove('.git/index.lock');
  await session.remove(`.git/refs/heads/${session.fixture.branch}.lock`);
});
