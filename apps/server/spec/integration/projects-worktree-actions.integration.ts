import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { eventually, expectation, settledReceipt } from '../kit/reads.ts';
import {
  commitReviewFixture,
  read,
  sampleReview,
  toolCall,
  toolValue,
  worktreePath,
} from '../kit/requests.ts';
import { list, record, text, type Session } from '../kit/session.ts';
import { test } from '../kit/server-test.ts';

const options = {
  deleteWorktree: true,
  deleteLocalBranch: true,
  deleteRemoteBranch: false,
};
const at = (worktreeId: string) => `/api/worktrees/${worktreeId}/delete`;
async function linked(session: Session, detached = false) {
  const path = `${session.projectHome}/${detached ? 'detached-topic' : 'delete-topic'}`;
  await session.git(
    'worktree',
    'add',
    ...(detached ? ['--detach', path] : ['-b', 'delete-topic', path]),
  );
  await read(session, { method: 'POST', path: '/api/inventory/refresh' });
  const inventory = await read(session, {
    method: 'GET',
    path: '/api/inventory',
  });
  const tree = list(record(list(inventory.projects)[0]).worktrees)
    .map(record)
    .find((row) => row.path === path);
  return { path, id: text(tree?.id) };
}

test('generic cleanup refuses main, zero options, detached branch flags, locked worktrees and unpaired requests before deleting anything', async ({
  session,
}) => {
  await commitReviewFixture(session);
  const tree = await linked(session);
  await read(
    session,
    { method: 'POST', path: at(session.worktreeId), body: { options } },
    409,
  );
  await read(
    session,
    {
      method: 'POST',
      path: at(tree.id),
      body: {
        options: {
          deleteWorktree: false,
          deleteLocalBranch: false,
          deleteRemoteBranch: false,
        },
      },
    },
    409,
  );
  await session.git('worktree', 'lock', tree.path);
  await read(
    session,
    { method: 'POST', path: at(tree.id), body: { options } },
    409,
  );
  await session.git('worktree', 'unlock', tree.path);
  const detached = await linked(session, true);
  await read(
    session,
    { method: 'POST', path: at(detached.id), body: { options } },
    409,
  );
  await read(
    session,
    { method: 'POST', path: at(tree.id), body: { options }, auth: 'none' },
    401,
  );
  expect(await session.entries(tree.path)).toContain(
    session.fixture.readme.path,
  );
  expect(
    (await session.git('branch', '--list', 'delete-topic')).trim(),
  ).toContain('delete-topic');
  await session.git('worktree', 'remove', tree.path);
  await session.git('worktree', 'remove', detached.path);
  await session.git('branch', '-D', 'delete-topic');
});

test('generic deletion protects stale and unacknowledged changes, then deletes the exact resources while retaining its open linked review', async ({
  session,
}) => {
  await commitReviewFixture(session);
  await session.git(
    'remote',
    'add',
    'origin',
    'git@github.com:FabioFiorita/porcelain.git',
  );
  const remote = `${session.projectHome}/cleanup-remote.git`;
  await session.git('init', '--bare', '-b', session.fixture.branch, remote);
  await session.git('remote', 'set-url', '--push', 'origin', remote);
  await session.git('push', remote, session.fixture.branch);
  const pushedHead = (await session.git('rev-parse', 'HEAD')).trim();
  await session.git(
    'commit',
    '--allow-empty',
    '-m',
    'Keep unpublished worktree history',
  );
  const tree = await linked(session);
  expect(
    (
      await session.git('rev-list', '--count', 'delete-topic', `^${pushedHead}`)
    ).trim(),
  ).toBe('1');
  const published = record(
    toolValue(
      await read(
        session,
        toolCall({ ...session, repository: tree.path }, 1, 'publish_review', {
          ...sampleReview(session, 0, randomUUID(), randomUUID()),
          pullRequest: 'https://github.com/FabioFiorita/porcelain/pull/423',
        }),
      ),
    ),
  );
  expect(typeof published.reviewId).toBe('string');
  const preview = await read(session, {
    method: 'POST',
    path: at(tree.id),
    body: { options },
  });
  expect(preview).toMatchObject({
    deleted: false,
    plan: {
      worktreePath: tree.path,
      localBranch: 'delete-topic',
      dirty: false,
    },
  });
  await session.writeFile(
    'local-only.txt',
    'Must survive stale confirmation\n',
  );
  await session.rename(
    `${session.repository}/local-only.txt`,
    `${tree.path}/local-only.txt`,
  );
  await read(
    session,
    {
      method: 'POST',
      path: at(tree.id),
      body: {
        options,
        confirmation: { plan: preview.plan, discardChanges: true },
      },
    },
    409,
  );
  expect(await session.entries(tree.path)).toContain('local-only.txt');
  const current = await read(session, {
    method: 'POST',
    path: at(tree.id),
    body: { options },
  });
  expect(record(current.plan)).toMatchObject({ dirty: true, unpushed: true });
  await read(
    session,
    {
      method: 'POST',
      path: at(tree.id),
      body: {
        options,
        confirmation: { plan: current.plan, discardChanges: false },
      },
    },
    409,
  );
  expect(
    await read(session, {
      method: 'POST',
      path: at(tree.id),
      body: {
        options,
        confirmation: { plan: current.plan, discardChanges: true },
      },
    }),
  ).toMatchObject({ deleted: true });
  expect((await session.git('branch', '--list', 'delete-topic')).trim()).toBe(
    '',
  );
  expect(await session.entries(session.projectHome)).not.toContain(
    'delete-topic',
  );
  expect(
    await read(session, {
      method: 'GET',
      path: `/api/reviews/${text(published.reviewId)}`,
    }),
  ).toMatchObject({ review: { archived: false, state: 'open' } });
  await eventually(
    session,
    { method: 'GET', path: '/api/inventory' },
    (body) => list(record(list(body.projects)[0]).worktrees).length === 1,
  );
});

test('switching the main worktree uses durable receipts and refuses dirty files without discarding them', async ({
  session,
}) => {
  await commitReviewFixture(session);
  await session.git('branch', 'switch-topic');
  const expected = await expectation(session);
  const requestId = randomUUID();
  const body = {
    requestId,
    input: { action: 'switch', targetRef: 'refs/heads/switch-topic' },
    expected,
  };
  expect(
    (
      await session.send({
        method: 'POST',
        path: worktreePath(session, '/git/actions'),
        body,
      })
    ).status,
  ).toBe(202);
  expect((await settledReceipt(session, requestId)).receipt).toMatchObject({
    action: 'switch',
    state: 'succeeded',
    result: { branch: 'switch-topic' },
  });
  expect((await session.git('branch', '--show-current')).trim()).toBe(
    'switch-topic',
  );
  expect(
    await read(session, {
      method: 'POST',
      path: worktreePath(session, '/git/actions'),
      body,
    }),
  ).toMatchObject({ requestId, state: 'succeeded' });
  await session.writeFile('unsaved.txt', 'Keep this local file\n');
  const refusedId = randomUUID();
  await read(
    session,
    {
      method: 'POST',
      path: worktreePath(session, '/git/actions'),
      body: {
        requestId: refusedId,
        input: {
          action: 'switch',
          targetRef: `refs/heads/${session.fixture.branch}`,
        },
        expected: { ...expected, branch: 'switch-topic' },
      },
    },
    202,
  );
  expect((await settledReceipt(session, refusedId)).receipt).toMatchObject({
    state: 'rejected',
    reason: 'CHECKOUT_BUSY',
  });
  expect(await session.readFile('unsaved.txt')).toBe('Keep this local file\n');
  expect((await session.git('branch', '--show-current')).trim()).toBe(
    'switch-topic',
  );
});
