import { expect } from 'vitest';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text, type Session } from '../kit/session.ts';

const MAIN = 'refs/heads/main';
const FEATURE = 'refs/heads/feature';
const SECOND = 'refs/heads/second';

async function fingerprints(session: Session, base?: string) {
  const body = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/branch-changes'),
    ...(base === undefined ? {} : { query: { base } }),
  });
  return new Map(
    list(body.files).map((entry) => [
      text(record(entry).path),
      text(record(entry).fingerprint),
    ]),
  );
}

const featureMarks = (session: Session) =>
  read(session, {
    method: 'GET',
    path: worktreePath(session, '/reviewed'),
    query: { scope: 'branch', branch: FEATURE },
  });

const markOf = (body: unknown, path: string) =>
  record(list(record(body).marks).find((mark) => record(mark).path === path))
    .fingerprint;

const fileOf = (body: unknown, path: string) =>
  record(list(record(body).files).find((file) => record(file).path === path))
    .fingerprint;

test('marking every file of the branch against its base marks them all', async ({
  session,
}) => {
  await session.git('switch', '-c', 'feature');
  await session.writeFile('notes.md', 'first\n');
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Add notes');
  await session.git('branch', 'checkpoint');
  await session.writeFile('notes.md', 'first\nsecond\n');
  await session.git('commit', '-am', 'Change notes and the readme');
  const shown = await fingerprints(session);

  const response = await session.send({
    method: 'PUT',
    path: worktreePath(session, '/reviewed-bulk'),
    body: {
      files: [...shown].map(([path, fingerprint]) => ({ path, fingerprint })),
      scope: 'branch',
      base: MAIN,
    },
  });

  expect(response.status).toBe(200);
  expect(record(response.body).marked).toStrictEqual([
    session.fixture.readme.path,
    'notes.md',
  ]);
});

test('a commit that leaves a file alone keeps its branch mark current', async ({
  session,
}) => {
  await session.writeFile('other.md', 'other\n');
  await session.git('add', 'other.md');
  await session.git('commit', '-m', 'Add another file');
  const marks = await featureMarks(session);

  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/branch-changes'),
  });

  expect(response.status).toBe(200);
  expect(fileOf(response.body, 'notes.md')).toStrictEqual(
    markOf(marks, 'notes.md'),
  );
});

test('comparing against another base stales only the files whose base side differs', async ({
  session,
}) => {
  const marks = await featureMarks(session);

  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/branch-changes'),
    query: { base: 'refs/heads/checkpoint' },
  });

  expect(response.status).toBe(200);
  expect(fileOf(response.body, session.fixture.readme.path)).toStrictEqual(
    markOf(marks, session.fixture.readme.path),
  );
  expect(fileOf(response.body, 'notes.md')).not.toStrictEqual(
    markOf(marks, 'notes.md'),
  );
});

test('another branch in the worktree starts without marks, keeps its own, and switching back finds the first branch marks', async ({
  session,
}) => {
  await session.git('switch', '-c', 'second', 'main');
  await session.writeFile('notes.md', 'first\nsecond\n');
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Add the same notes');
  const shown = await fingerprints(session);
  const notes = shown.get('notes.md') ?? '';

  const first = await session.send({
    method: 'GET',
    path: worktreePath(session, '/reviewed'),
    query: { scope: 'branch', branch: SECOND },
  });
  const marked = await session.send({
    method: 'PUT',
    path: worktreePath(session, '/reviewed-bulk'),
    body: {
      files: [{ path: 'notes.md', fingerprint: notes }],
      scope: 'branch',
      base: MAIN,
    },
  });

  expect(first.status).toBe(200);
  expect(first.body).toStrictEqual({
    worktreeId: session.worktreeId,
    marks: [],
  });
  expect(marked.status).toBe(200);
  expect(
    list(record(marked.body).marks).map((mark) => record(mark).path),
  ).toStrictEqual(['notes.md']);
  await session.git('switch', 'feature');
  const back = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/reviewed'),
    query: { scope: 'branch', branch: FEATURE },
  });
  expect(list(back.marks).map((mark) => record(mark).path)).toStrictEqual([
    session.fixture.readme.path,
    'notes.md',
  ]);
});
