import { randomUUID } from 'node:crypto';
import { readChangesResponseSchema } from '@porcelain/contracts/changes';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect } from 'vitest';
import { eventually } from '../kit/reads.ts';
import { read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const BRANCH = 'linked';
const inventory: HttpRequest = { method: 'GET', path: '/api/inventory' };
const linkedPath = (session: Session) => `${session.projectHome}/${BRANCH}`;
const worktreesOf = (body: Record<string, unknown>) =>
  list(record(list(body.projects)[0]).worktrees).map((entry) => record(entry));
const at = (worktreeId: string, suffix: string) =>
  `/api/worktrees/${worktreeId}${suffix}`;

async function linkedId(session: Session) {
  const linked = worktreesOf(await read(session, inventory)).find(
    (worktree) => worktree.path === linkedPath(session),
  );
  if (typeof linked?.id !== 'string')
    throw new Error('The linked worktree is not listed');
  return linked.id;
}

async function settled(session: Session, worktreeId: string, id: string) {
  return eventually(
    session,
    { method: 'GET', path: at(worktreeId, `/git/receipts/${id}`) },
    (receipt) => receipt.state !== 'running',
  );
}

test('a worktree added with git worktree add is listed beside the main checkout on its own branch, available', async ({
  session,
}) => {
  await session.git('worktree', 'add', '-b', BRANCH, linkedPath(session));
  await eventually(
    session,
    inventory,
    (body) => worktreesOf(body).length === 2,
  );

  const response = await session.send(inventory);

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(readInventoryResponseSchema),
  );
  const worktrees = worktreesOf(record(response.body));
  expect(worktrees).toHaveLength(2);
  expect(worktrees.find((worktree) => worktree.main === true)).toMatchObject({
    id: session.worktreeId,
    path: session.repository,
    main: true,
    branch: `refs/heads/${session.fixture.branch}`,
    available: true,
  });
  expect(worktrees.find((worktree) => worktree.main === false)).toMatchObject({
    path: linkedPath(session),
    main: false,
    branch: `refs/heads/${BRANCH}`,
    available: true,
    status: null,
  });
});

test('reading a linked worktree answers its own checkout, not the edits of the main one', async ({
  session,
}) => {
  const worktreeId = await linkedId(session);

  const text = await session.send({
    method: 'GET',
    path: at(worktreeId, '/text'),
    query: { path: session.fixture.readme.path },
  });
  const changes = await session.send({
    method: 'GET',
    path: at(worktreeId, '/changes'),
  });

  expect([text.status, changes.status]).toStrictEqual([200, 200]);
  expect(text.body).toMatchObject({
    worktreeId,
    path: session.fixture.readme.path,
    text: session.fixture.readme.committed,
  });
  expect(changes.body).toEqual(
    expect.schemaMatching(readChangesResponseSchema),
  );
  expect(record(changes.body).changes).toStrictEqual([]);
});

test('a commit in a linked worktree goes to its branch and leaves the main checkout alone', async ({
  session,
}) => {
  const worktreeId = await linkedId(session);
  const note = 'linked-note.md';
  await session.writeFile(note, 'A note in the linked worktree\n');
  await session.rename(
    `${session.repository}/${note}`,
    `${linkedPath(session)}/${note}`,
  );
  const status = await eventually(
    session,
    { method: 'GET', path: at(worktreeId, '/changes') },
    (body) => list(body.changes).length === 1,
  );
  const change = record(list(status.changes)[0]);
  const requestId = randomUUID();

  const response = await session.send({
    method: 'POST',
    path: at(worktreeId, '/git/actions'),
    body: {
      requestId,
      input: {
        action: 'commit',
        message: 'Keep a note in the linked worktree',
        paths: [note],
      },
      expected: {
        headOid: status.headOid,
        branch: BRANCH,
        inProgress: null,
        mergeHeadOid: null,
        files: [{ path: note, fingerprint: change.fingerprint }],
      },
    },
  });

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    requestId,
    action: 'commit',
    state: 'running',
  });
  expect(await settled(session, worktreeId, requestId)).toMatchObject({
    requestId,
    state: 'succeeded',
  });
  expect((await session.git('log', '-1', '--format=%s', BRANCH)).trim()).toBe(
    'Keep a note in the linked worktree',
  );
  expect((await session.git('log', '-1', '--format=%s')).trim()).toBe(
    session.fixture.initialCommit,
  );
});
