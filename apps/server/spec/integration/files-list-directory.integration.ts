import { listDirectoryResponseSchema } from '@porcelain/contracts/files';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownWorktreeId,
  unreadablePath,
  worktreeNotFound,
} from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const directory = (session: Session, path?: string): HttpRequest => ({
  method: 'GET',
  path: worktreePath(session, '/directory'),
  ...(path === undefined ? {} : { query: { path } }),
});

test('listing the root names each entry with its kind, flags an ignored file and never lists .git', async ({
  session,
}) => {
  await session.writeFile('.gitignore', 'build.log\n');
  await session.writeFile('build.log', 'ignored\n');

  const response = await session.send(directory(session, ''));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(listDirectoryResponseSchema),
  );
  expect(response.body).toStrictEqual({
    worktreeId: session.worktreeId,
    path: '',
    entries: [
      { name: '.gitignore', kind: 'file' },
      { name: session.fixture.readme.path, kind: 'file' },
      { name: 'build.log', kind: 'file', ignored: true },
    ],
  });
});

test('listing a folder that does not exist is not found', async ({
  session,
}) => {
  const response = await session.send(directory(session, 'missing'));

  expect(response.status).toBe(404);
  expect(response.body).toStrictEqual(
    apiError(404, 'Not Found', 'Path not found'),
  );
});

test('listing the .git folder is invalid input', async ({ session }) => {
  const response = await session.send(directory(session, '.git'));

  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(invalidRequest);
});

test('listing an escaping path or no path at all is invalid input, and listing an unknown worktree is not found', async ({
  session,
}) => {
  const invalid = [
    await session.send(directory(session, '../')),
    await session.send(directory(session)),
  ];
  const unknown = await session.send({
    method: 'GET',
    path: `/api/worktrees/${unknownWorktreeId}/directory`,
    query: { path: '' },
  });

  for (const response of invalid) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
});

test('a symbolic link out of the worktree is listed with its target but cannot be listed into', async ({
  session,
}) => {
  await session.symlink('..', 'up');

  const link = await session.send(directory(session, 'up'));
  const root = await session.send(directory(session, ''));

  expect(link.status).toBe(422);
  expect(link.body).toStrictEqual(unreadablePath);
  expect(root.status).toBe(200);
  expect(
    list(record(root.body).entries).filter(
      (entry) => record(entry).name === 'up',
    ),
  ).toMatchObject([{ name: 'up', kind: 'symlink', target: '..' }]);
});
