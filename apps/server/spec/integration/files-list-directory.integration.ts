import { listDirectoryResponseSchema } from '@porcelain/contracts/files';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DIRECTORY_ENTRIES } from '@porcelain/contracts/shared';
import * as Schema from 'effect/Schema';
import { expect } from 'vite-plus/test';
import { apiError, unreadablePath } from '../kit/answers.ts';
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
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(listDirectoryResponseSchema)),
    ),
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

test('a folder with more entries than the limit lists its first folders and files and counts the rest', async ({
  session,
  onTestFinished,
}) => {
  await mkdir(join(session.repository, 'bulk/zz-folder'), { recursive: true });
  onTestFinished(() =>
    rm(join(session.repository, 'bulk'), { recursive: true }),
  );
  await session.writeFile('bulk/zz-folder/inside.txt', 'inside\n');
  await Promise.all(
    Array.from({ length: DIRECTORY_ENTRIES + 1 }, (_, index) =>
      session.writeFile(
        `bulk/file-${String(index).padStart(5, '0')}.txt`,
        `${index}\n`,
      ),
    ),
  );

  const response = await session.send(directory(session, 'bulk'));

  expect(response.status).toBe(200);
  const entries = list(record(response.body).entries).map(record);
  expect(entries).toHaveLength(DIRECTORY_ENTRIES);
  expect(entries).toContainEqual({ name: 'zz-folder', kind: 'directory' });
  expect(entries).toContainEqual({ name: 'file-00000.txt', kind: 'file' });
  expect(entries).not.toContainEqual({
    name: `file-${String(DIRECTORY_ENTRIES).padStart(5, '0')}.txt`,
    kind: 'file',
  });
  expect(record(response.body).omitted).toBe(2);
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
