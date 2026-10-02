import {
  listBranchBasesResponseSchema,
  readBranchChangesResponseSchema,
} from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { blobOf, head } from '../kit/reads.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

function branchChanges(session: Session, base?: string): HttpRequest {
  return {
    method: 'GET',
    path: worktreePath(session, '/branch-changes'),
    ...(base === undefined ? {} : { query: { base } }),
  };
}

function fileAt(body: unknown, index: number) {
  return list(record(body).files)[index];
}

async function forkFeature(session: Session) {
  const fork = await head(session);
  await session.git('switch', '-c', 'feature');
  await session.git('commit', '-am', 'Change the readme');
  await session.writeFile('notes.md', 'notes\n');
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Add notes');
  await session.git('switch', session.fixture.branch);
  await session.writeFile('main-only.md', 'main\n');
  await session.git('add', 'main-only.md');
  await session.git('commit', '-m', 'Main moves on');
  const main = await head(session);
  await session.git('switch', 'feature');
  await session.git('branch', 'fork-point', fork);
  return { fork, main, tip: await head(session) };
}

test('the branch changes list the files the branch changed since it forked from the default branch', async ({
  session,
}) => {
  const state = await forkFeature(session);

  const response = await session.send(branchChanges(session));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(readBranchChangesResponseSchema),
  );
  const body = record(response.body);
  expect(body.head).toStrictEqual({
    oid: state.tip,
    branch: 'refs/heads/feature',
  });
  expect(body.base).toStrictEqual({
    ref: `refs/heads/${session.fixture.branch}`,
    oid: state.main,
  });
  expect(body.mergeBaseOid).toBe(state.fork);
  expect(body.commits).toBe(2);
  expect(list(body.files)).toHaveLength(2);
  expect(fileAt(response.body, 0)).toMatchObject({
    path: session.fixture.readme.path,
    oldPath: session.fixture.readme.path,
    newPath: session.fixture.readme.path,
    status: 'modified',
    oldMode: '100644',
    newMode: '100644',
  });
  expect(fileAt(response.body, 1)).toMatchObject({
    path: 'notes.md',
    oldPath: null,
    newPath: 'notes.md',
    status: 'added',
    oldMode: '000000',
    newMode: '100644',
  });
  expect(record(fileAt(response.body, 0)).fingerprint).toMatch(
    /^[a-f0-9]{64}$/u,
  );
});

test('the branch changes compare against a chosen base branch, and the branch against itself has nothing of its own', async ({
  session,
}) => {
  const fork = await blobOf(session, 'fork-point');
  const tip = await head(session);

  const responses = [
    await session.send(branchChanges(session, 'refs/heads/fork-point')),
    await session.send(branchChanges(session, 'refs/heads/feature')),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([200, 200]);
  expect(record(responses[0]?.body).base).toStrictEqual({
    ref: 'refs/heads/fork-point',
    oid: fork,
  });
  expect(list(record(responses[0]?.body).files)).toHaveLength(2);
  const itself = record(responses[1]?.body);
  expect(itself.base).toStrictEqual({ ref: 'refs/heads/feature', oid: tip });
  expect(itself.mergeBaseOid).toBe(tip);
  expect(itself.commits).toBe(0);
  expect(itself.files).toStrictEqual([]);
});

test('the branch bases list every local branch to compare against and name the default', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/branch-bases'),
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(listBranchBasesResponseSchema),
  );
  expect(response.body).toStrictEqual({
    defaultRef: `refs/heads/${session.fixture.branch}`,
    bases: [
      {
        ref: 'refs/heads/fork-point',
        name: 'fork-point',
        remote: false,
      },
      { ref: 'refs/heads/feature', name: 'feature', remote: false },
      {
        ref: `refs/heads/${session.fixture.branch}`,
        name: session.fixture.branch,
        remote: false,
      },
    ],
  });
});

test('a missing base branch is not found, a base that is not a plain branch ref is refused, and an unknown worktree is not found', async ({
  session,
}) => {
  const responses = [
    await session.send(branchChanges(session, 'refs/heads/nope')),
    await session.send(branchChanges(session, 'main')),
    await session.send(branchChanges(session, 'refs/heads/main~1')),
    await session.send({
      method: 'GET',
      path: `/api/worktrees/${unknownWorktreeId}/branch-changes`,
    }),
    await session.send({
      method: 'GET',
      path: `/api/worktrees/${unknownWorktreeId}/branch-bases`,
    }),
  ];

  expect(responses[0]?.status).toBe(404);
  expect(responses[0]?.body).toStrictEqual(
    apiError(404, 'Not Found', 'Base branch not found'),
  );
  expect(responses[1]?.status).toBe(400);
  expect(responses[1]?.body).toStrictEqual(invalidRequest);
  expect(responses[2]?.status).toBe(400);
  expect(responses[2]?.body).toStrictEqual(
    apiError(400, 'Bad Request', 'Invalid history request'),
  );
  for (const response of responses.slice(3)) {
    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual(worktreeNotFound);
  }
});

test('without a default branch the branch changes have no base and no files', async ({
  session,
}) => {
  await session.git('branch', '-m', session.fixture.branch, 'trunk');
  const tip = await head(session);

  const response = await session.send(branchChanges(session));

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    worktreeId: session.worktreeId,
    head: { oid: tip, branch: 'refs/heads/feature' },
    base: null,
    mergeBaseOid: null,
    commits: 0,
    files: [],
  });
  await session.git('branch', '-m', 'trunk', session.fixture.branch);
});

test('a branch with no commits, then one with no history in common with its base, cannot be compared', async ({
  session,
}) => {
  await session.git('switch', '--orphan', 'island');

  const response = await session.send(branchChanges(session));

  expect(response.status).toBe(409);
  expect(response.body).toStrictEqual(
    apiError(409, 'Conflict', 'The branch has no commits yet'),
  );
  await session.writeFile('island.md', 'island\n');
  await session.git('add', 'island.md');
  await session.git('commit', '-m', 'Island');
  const unrelated = await session.send(branchChanges(session));
  expect(unrelated.status).toBe(409);
  expect(unrelated.body).toStrictEqual(
    apiError(409, 'Conflict', 'The branch shares no history with its base'),
  );
});
