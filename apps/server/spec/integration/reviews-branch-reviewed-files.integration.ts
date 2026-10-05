import * as Schema from 'effect/Schema';
import {
  listReviewedFilesResponseSchema,
  removeReviewedFilesResponseSchema,
} from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import { apiError, invalidRequest } from '../kit/answers.ts';
import { fingerprintOf } from '../kit/reads.ts';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text, type Session } from '../kit/session.ts';

const reviewed = (session: Session) => worktreePath(session, '/reviewed');
const BASE = 'refs/heads/main';
const FEATURE = 'refs/heads/feature';
const staleMark = apiError(
  409,
  'Conflict',
  'The reviewed mark is based on a version that has changed',
);
const paths = (body: unknown) =>
  list(record(body).marks).map((mark) => record(mark).path);

async function branchFingerprint(session: Session, path: string) {
  const body = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/branch-changes'),
  });
  const file = list(body.files).find((entry) => record(entry).path === path);
  return text(record(file).fingerprint);
}

const branchMarks = (session: Session) =>
  read(session, {
    method: 'GET',
    path: reviewed(session),
    query: { scope: 'branch', branch: FEATURE },
  });

const worktreeMarks = (session: Session) =>
  read(session, { method: 'GET', path: reviewed(session) });

test('marking a branch file at the fingerprint the branch comparison showed keeps a branch mark apart from the working tree', async ({
  session,
}) => {
  await session.git('switch', '-c', 'feature');
  await session.git('commit', '-am', 'Change the readme');
  await session.writeFile('notes.md', 'notes\n');
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Add notes');
  const fingerprint = await branchFingerprint(session, 'notes.md');

  const response = await session.send({
    method: 'PUT',
    path: reviewed(session),
    body: {
      path: 'notes.md',
      reviewed: true,
      fingerprint,
      scope: 'branch',
      base: BASE,
    },
  });

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    worktreeId: session.worktreeId,
    marks: [{ path: 'notes.md', fingerprint }],
  });
  expect(await branchMarks(session)).toStrictEqual(response.body);
  expect(await worktreeMarks(session)).toStrictEqual({
    worktreeId: session.worktreeId,
    marks: [],
  });
});

test('marking one path in both the working-tree and the branch scope keeps both marks with their own fingerprints', async ({
  session,
}) => {
  await session.writeFile(session.fixture.readme.path, 'uncommitted\n');
  const fingerprints = {
    worktree: await fingerprintOf(session, session.fixture.readme.path),
    branch: await branchFingerprint(session, session.fixture.readme.path),
  };

  const inWorktree = await session.send({
    method: 'PUT',
    path: reviewed(session),
    body: {
      path: session.fixture.readme.path,
      reviewed: true,
      fingerprint: fingerprints.worktree,
    },
  });
  const inBranch = await session.send({
    method: 'PUT',
    path: reviewed(session),
    body: {
      path: session.fixture.readme.path,
      reviewed: true,
      fingerprint: fingerprints.branch,
      scope: 'branch',
      base: BASE,
    },
  });

  expect([inWorktree.status, inBranch.status]).toStrictEqual([200, 200]);
  expect(inBranch.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(listReviewedFilesResponseSchema),
      ),
    ),
  );
  expect(paths(inWorktree.body)).toStrictEqual([session.fixture.readme.path]);
  expect(paths(inBranch.body)).toStrictEqual([
    session.fixture.readme.path,
    'notes.md',
  ]);
  const branch = list((await branchMarks(session)).marks);
  expect(record(branch[0]).fingerprint).toStrictEqual(fingerprints.branch);
  const worktree = list((await worktreeMarks(session)).marks);
  expect(record(worktree[0]).fingerprint).toStrictEqual(fingerprints.worktree);
});

test('an uncommitted edit leaves the branch fingerprint of a file alone', async ({
  session,
}) => {
  const before = await branchFingerprint(session, 'notes.md');
  await session.writeFile('notes.md', 'edited without committing\n');

  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/branch-changes'),
  });

  expect(response.status).toBe(200);
  expect(
    record(
      list(record(response.body).files).find(
        (entry) => record(entry).path === 'notes.md',
      ),
    ).fingerprint,
  ).toStrictEqual(before);
});

test('a new commit makes a branch mark stale, and marking many reports stale and unchanged files as conflicts', async ({
  session,
}) => {
  const before = await branchFingerprint(session, 'notes.md');
  await session.git('commit', '-am', 'Change the notes');
  const after = await branchFingerprint(session, 'notes.md');

  const stale = await session.send({
    method: 'PUT',
    path: reviewed(session),
    body: {
      path: 'notes.md',
      reviewed: true,
      fingerprint: before,
      scope: 'branch',
      base: BASE,
    },
  });
  const many = await session.send({
    method: 'PUT',
    path: worktreePath(session, '/reviewed-bulk'),
    body: {
      files: [
        { path: 'notes.md', fingerprint: after },
        { path: session.fixture.readme.path, fingerprint: before },
        { path: 'untouched.md', fingerprint: before },
      ],
      scope: 'branch',
      base: BASE,
    },
  });

  expect(stale.status).toBe(409);
  expect(stale.body).toStrictEqual(staleMark);
  expect(many.status).toBe(200);
  const bulk = record(many.body);
  expect(bulk.marked).toStrictEqual(['notes.md']);
  expect(bulk.conflicts).toStrictEqual([
    { path: session.fixture.readme.path, reason: 'stale' },
    { path: 'untouched.md', reason: 'missing' },
  ]);
  expect(record(list(bulk.marks)[1]).fingerprint).not.toStrictEqual(before);
});

test('unmarking files in the branch scope leaves the working-tree marks alone', async ({
  session,
}) => {
  const one = await session.send({
    method: 'DELETE',
    path: reviewed(session),
    query: { path: 'notes.md', scope: 'branch', branch: FEATURE },
  });
  const many = await session.send({
    method: 'DELETE',
    path: worktreePath(session, '/reviewed-bulk'),
    body: {
      paths: [session.fixture.readme.path],
      scope: 'branch',
      branch: FEATURE,
    },
  });

  expect([one.status, many.status]).toStrictEqual([200, 200]);
  expect(one.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(removeReviewedFilesResponseSchema),
      ),
    ),
  );
  expect(paths(one.body)).toStrictEqual([session.fixture.readme.path]);
  expect(many.body).toStrictEqual({
    worktreeId: session.worktreeId,
    marks: [],
  });
  expect(paths(await worktreeMarks(session))).toStrictEqual([
    session.fixture.readme.path,
  ]);
});

test('a branch mark without a base, against a missing base, or a listing in an unknown scope is refused', async ({
  session,
}) => {
  const fingerprint = await branchFingerprint(session, 'notes.md');

  const noBase = await session.send({
    method: 'PUT',
    path: reviewed(session),
    body: {
      path: 'notes.md',
      reviewed: true,
      fingerprint,
      scope: 'branch',
    },
  });
  const missingBase = await session.send({
    method: 'PUT',
    path: reviewed(session),
    body: {
      path: 'notes.md',
      reviewed: true,
      fingerprint,
      scope: 'branch',
      base: 'refs/heads/nope',
    },
  });
  const unknownScope = await session.send({
    method: 'GET',
    path: reviewed(session),
    query: { scope: 'elsewhere' },
  });

  expect(noBase.status).toBe(400);
  expect(noBase.body).toStrictEqual(invalidRequest);
  expect(missingBase.status).toBe(404);
  expect(missingBase.body).toStrictEqual(
    apiError(404, 'Not Found', 'Base branch not found'),
  );
  expect(unknownScope.status).toBe(400);
  expect(unknownScope.body).toStrictEqual(invalidRequest);
});
