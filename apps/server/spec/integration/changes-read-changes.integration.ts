import { setTimeout as delay } from 'node:timers/promises';
import { readChangesResponseSchema } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import {
  blobOf,
  changes,
  fingerprintOf,
  head,
  inventory,
  workingBlobOf,
} from '../kit/reads.ts';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

function modified(
  session: Session,
  scope: 'staged' | 'unstaged',
  oldOid: string,
  newOid: string | null,
) {
  return {
    scope,
    kind: 'modified',
    oldPath: session.fixture.readme.path,
    newPath: session.fixture.readme.path,
    oldMode: '100644',
    newMode: '100644',
    oldOid,
    newOid,
    supported: true,
  };
}

function changesRead(session: Session): HttpRequest {
  return { method: 'GET', path: worktreePath(session, '/changes') };
}

const filtersUnsupported = apiError(
  422,
  'Unprocessable Entity',
  'Git conversion filters are unsupported for worktree inspection',
);

async function mergeConflicts(session: Session) {
  try {
    await session.git('merge', 'other');
  } catch {
    return;
  }
  throw new Error('The merge did not conflict');
}

test('reading the changes of the sample unstaged change returns its entry, the head, the branch and the status token', async ({
  session,
}) => {
  const headOid = await head(session);
  const committed = await blobOf(
    session,
    `HEAD:${session.fixture.readme.path}`,
  );
  const environment = await inventory(session);
  const before = await changes(session);

  const response = await session.send(changesRead(session));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(readChangesResponseSchema),
  );
  expect(response.body).toStrictEqual({
    environmentId: environment.environmentId,
    worktreeId: session.worktreeId,
    statusToken: before.statusToken,
    headOid,
    inProgress: null,
    mergeHeadOid: null,
    branch: {
      name: session.fixture.branch,
      upstream: null,
      ahead: 0,
      behind: 0,
    },
    changes: [
      {
        path: session.fixture.readme.path,
        fingerprint: before.changes[0]?.fingerprint,
        comparisons: [modified(session, 'unstaged', committed, null)],
      },
    ],
  });
});

test('reads that find the catalog entry stale refresh it and still answer the worktree as it was', async ({
  session,
}) => {
  const before = await read(session, changesRead(session));
  await delay(session.fixture.inventoryStaleAfterMs);

  const responses = [];
  for (let index = 0; index < 8; index += 1)
    responses.push(await session.send(changesRead(session)));

  expect(responses.map((entry) => entry.status)).toStrictEqual(
    Array.from({ length: 8 }, () => 200),
  );
  expect(responses.map((entry) => entry.body)).toStrictEqual(
    Array.from({ length: 8 }, () => before),
  );
});

test('reading the changes lists an untracked file and a staged change, and staging moves the fingerprint', async ({
  session,
}) => {
  const unstaged = await fingerprintOf(session, session.fixture.readme.path);
  await session.git('add', session.fixture.readme.path);
  await session.writeFile('notes.txt', 'untracked\n');
  const committed = await blobOf(
    session,
    `HEAD:${session.fixture.readme.path}`,
  );
  const staged = await workingBlobOf(session, session.fixture.readme.path);

  const response = await session.send(changesRead(session));

  expect(response.status).toBe(200);
  const entries = list(record(response.body).changes).map(record);
  expect(entries.map((entry) => entry.path)).toStrictEqual([
    'notes.txt',
    session.fixture.readme.path,
  ]);
  expect(entries[0]?.comparisons).toStrictEqual([
    { scope: 'untracked', path: 'notes.txt' },
  ]);
  expect(entries[0]?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(entries[1]?.comparisons).toStrictEqual([
    modified(session, 'staged', committed, staged),
  ]);
  expect(entries[1]?.fingerprint).not.toStrictEqual(unstaged);
});

test('reading the changes during a merge conflict reports the merge and the conflicted file as unmerged', async ({
  session,
}) => {
  const path = session.fixture.readme.path;
  await session.git('commit', '-m', 'Staged readme');
  await session.git('switch', '-c', 'other', 'HEAD~1');
  await session.writeFile(path, '# Another title\n');
  await session.git('commit', '-am', 'Retitle');
  const other = await head(session);
  await session.git('switch', session.fixture.branch);
  await mergeConflicts(session);
  const headOid = await head(session);

  const response = await session.send(changesRead(session));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(readChangesResponseSchema),
  );
  expect(response.body).toMatchObject({
    headOid,
    inProgress: 'merge',
    mergeHeadOid: other,
  });
  const readme = list(record(response.body).changes)
    .map(record)
    .find((entry) => entry.path === session.fixture.readme.path);
  expect(readme?.comparisons).toMatchObject([
    { scope: 'unmerged', path: session.fixture.readme.path },
  ]);
});

test('reading the changes of an unknown worktree is not found, and a malformed worktree id is refused', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'GET',
      path: `/api/worktrees/${unknownWorktreeId}/changes`,
    }),
    await session.send({
      method: 'GET',
      path: '/api/worktrees/not-an-id/changes',
    }),
  ];

  expect(responses[0]?.status).toBe(404);
  expect(responses[0]?.body).toStrictEqual(worktreeNotFound);
  expect(responses[1]?.status).toBe(400);
  expect(responses[1]?.body).toStrictEqual(invalidRequest);
});

test('a conversion filter on a tracked file refuses the changes read wherever the filter is assigned', async ({
  session,
}) => {
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/files'),
    body: { kind: 'create', path: 'nested', entryKind: 'directory' },
  });
  await session.writeFile('nested/tool.txt', 'tool\n');
  await session.git('add', 'nested/tool.txt');
  await session.writeFile('nested/.gitattributes', 'tool.txt filter=secret\n');

  const response = await session.send(changesRead(session));

  expect(response.status).toBe(422);
  expect(response.body).toStrictEqual(filtersUnsupported);
  await session.remove('nested/.gitattributes');
  expect(await read(session, changesRead(session))).toEqual(
    expect.schemaMatching(readChangesResponseSchema),
  );
  await session.writeFile(
    '.git/info/attributes',
    'nested/tool.txt filter=secret\n',
  );
  expect(await read(session, changesRead(session), 422)).toStrictEqual(
    filtersUnsupported,
  );
});
