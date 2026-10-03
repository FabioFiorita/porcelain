import { editFileResponseSchema } from '@porcelain/contracts/files';
import { expect } from 'vitest';
import {
  apiError,
  CREDENTIAL_LINK,
  invalidRequest,
  unreadablePath,
} from '../kit/answers.ts';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { type HttpRequest, type Session } from '../kit/session.ts';

const copy = (
  session: Session,
  path: string,
  destination: string,
): HttpRequest => ({
  method: 'POST',
  path: worktreePath(session, '/files'),
  body: { kind: 'copy', path, destination },
});

test('duplicating a changed file writes a copy with the same text and leaves the original as it was', async ({
  session,
}) => {
  const response = await session.send(
    copy(session, session.fixture.readme.path, 'README copy.md'),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ path: 'README copy.md' });
  expect(response.body).toEqual(expect.schemaMatching(editFileResponseSchema));
  expect(await session.readFile('README copy.md')).toBe(
    session.fixture.readme.changed,
  );
  expect(await session.readFile(session.fixture.readme.path)).toBe(
    session.fixture.readme.changed,
  );
  expect(await session.entries('')).toStrictEqual([
    '.git',
    'README copy.md',
    session.fixture.readme.path,
  ]);
});

test('duplicating onto an existing entry is a conflict that keeps it, and duplicating a missing source is not found', async ({
  session,
}) => {
  await session.writeFile('README copy.md', 'Kept\n');

  const conflict = await session.send(
    copy(session, session.fixture.readme.path, 'README copy.md'),
  );
  const missing = await session.send(
    copy(session, 'missing.md', 'missing copy.md'),
  );

  expect([conflict.status, missing.status]).toStrictEqual([409, 404]);
  expect(conflict.body).toStrictEqual(
    apiError(409, 'Conflict', 'An entry already exists at that path'),
  );
  expect(missing.body).toStrictEqual(
    apiError(404, 'Not Found', 'Path not found'),
  );
  expect(await session.readFile('README copy.md')).toBe('Kept\n');
});

test('duplicating a folder, a symbolic link or into a link out of the worktree cannot be done and copies nothing', async ({
  session,
}) => {
  await read(session, {
    method: 'POST',
    path: worktreePath(session, '/files'),
    body: { kind: 'create', path: 'docs', entryKind: 'directory' },
  });
  await session.symlink('..', 'up');
  await session.symlink(CREDENTIAL_LINK, 'secret.txt');
  const before = await session.entries('..');

  const responses = [
    await session.send(copy(session, 'docs', 'docs copy')),
    await session.send(copy(session, 'secret.txt', 'secret copy.txt')),
    await session.send(
      copy(session, session.fixture.readme.path, 'up/planted.md'),
    ),
  ];

  for (const response of responses) {
    expect(response.status).toBe(422);
    expect(response.body).toStrictEqual(unreadablePath);
  }
  expect(await session.entries('..')).toStrictEqual(before);
  expect(await session.entries('')).toStrictEqual([
    '.git',
    'README copy.md',
    session.fixture.readme.path,
    'docs',
    'secret.txt',
    'up',
  ]);
});

test('duplicating into .git or outside the worktree is invalid input', async ({
  session,
}) => {
  const responses = [
    await session.send(
      copy(session, session.fixture.readme.path, '.git/README.md'),
    ),
    await session.send(
      copy(session, session.fixture.readme.path, '../outside.md'),
    ),
  ];

  for (const response of responses) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
});
