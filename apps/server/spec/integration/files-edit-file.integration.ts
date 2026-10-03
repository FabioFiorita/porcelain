import { editFileResponseSchema } from '@porcelain/contracts/files';
import { expect } from 'vitest';
import {
  apiError,
  CREDENTIAL_LINK,
  invalidRequest,
  unknownFingerprint,
  unknownWorktreeId,
  unreadablePath,
  worktreeNotFound,
} from '../kit/answers.ts';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { text, type HttpRequest, type Session } from '../kit/session.ts';

const edit = (session: Session, body: unknown): HttpRequest => ({
  method: 'POST',
  path: worktreePath(session, '/files'),
  body,
});

async function contentFingerprint(session: Session, path: string) {
  const file = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/text'),
    query: { path },
  });
  return text(file.contentFingerprint);
}

test('writing a file with the fingerprint just read replaces its text and answers the new fingerprint', async ({
  session,
}) => {
  const fingerprint = await contentFingerprint(
    session,
    session.fixture.readme.path,
  );

  const response = await session.send(
    edit(session, {
      kind: 'write',
      path: session.fixture.readme.path,
      text: 'Rewritten\n',
      expectedFingerprint: fingerprint,
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(expect.schemaMatching(editFileResponseSchema));
  const written = await contentFingerprint(
    session,
    session.fixture.readme.path,
  );
  expect(response.body).toStrictEqual({
    path: session.fixture.readme.path,
    contentFingerprint: written,
  });
  expect(written).not.toStrictEqual(fingerprint);
  expect(await session.readFile(session.fixture.readme.path)).toBe(
    'Rewritten\n',
  );
});

test('writing over content that changed since it was read is a conflict and keeps the newer content', async ({
  session,
}) => {
  const seen = await contentFingerprint(session, session.fixture.readme.path);
  await session.writeFile(session.fixture.readme.path, 'Changed elsewhere\n');

  const response = await session.send(
    edit(session, {
      kind: 'write',
      path: session.fixture.readme.path,
      text: 'Lost\n',
      expectedFingerprint: seen,
    }),
  );

  expect(response.status).toBe(409);
  expect(response.body).toStrictEqual(
    apiError(
      409,
      'Conflict',
      'Content changed; retry the operation',
      'content_changed',
    ),
  );
  expect(await session.readFile(session.fixture.readme.path)).toBe(
    'Changed elsewhere\n',
  );
});

test('creating a folder and a file and then moving the file into the folder answers each resulting path', async ({
  session,
}) => {
  const responses = [
    await session.send(
      edit(session, { kind: 'create', path: 'docs', entryKind: 'directory' }),
    ),
    await session.send(
      edit(session, { kind: 'create', path: 'draft.md', entryKind: 'file' }),
    ),
    await session.send(
      edit(session, {
        kind: 'move',
        path: 'draft.md',
        destination: 'docs/final.md',
      }),
    ),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([200, 200, 200]);
  expect(responses.map((entry) => entry.body)).toStrictEqual([
    { path: 'docs' },
    { path: 'draft.md' },
    { path: 'docs/final.md' },
  ]);
  expect(await session.readFile('docs/final.md')).toBe('');
  expect(await session.entries('')).toStrictEqual([
    '.git',
    session.fixture.readme.path,
    'docs',
  ]);
  expect(await session.entries('docs')).toStrictEqual(['final.md']);
});

test('creating a file over an existing entry is a conflict and leaves the entry as it was', async ({
  session,
}) => {
  const response = await session.send(
    edit(session, {
      kind: 'create',
      path: session.fixture.readme.path,
      entryKind: 'file',
    }),
  );

  expect(response.status).toBe(409);
  expect(response.body).toStrictEqual(
    apiError(409, 'Conflict', 'An entry already exists at that path'),
  );
  expect(await session.readFile(session.fixture.readme.path)).toBe(
    'Changed elsewhere\n',
  );
});

test('moving a file to the trash removes it from the worktree and answers its path', async ({
  session,
}) => {
  const response = await session.send(
    edit(session, { kind: 'trash', path: 'docs/final.md' }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ path: 'docs/final.md' });
  expect(await session.entries('docs')).toStrictEqual([]);
});

test('moving an entry that does not exist is not found', async ({
  session,
}) => {
  const response = await session.send(
    edit(session, {
      kind: 'move',
      path: 'missing.md',
      destination: 'docs/missing.md',
    }),
  );

  expect(response.status).toBe(404);
  expect(response.body).toStrictEqual(
    apiError(404, 'Not Found', 'Path not found'),
  );
});

test('creating a file inside .git is invalid input and creates nothing there', async ({
  session,
}) => {
  const before = await session.entries('.git');

  const response = await session.send(
    edit(session, {
      kind: 'create',
      path: '.git/hooks/pre-commit',
      entryKind: 'file',
    }),
  );

  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(invalidRequest);
  expect(await session.entries('.git')).toStrictEqual(before);
});

test('an escaping path, an unknown kind or a write without a fingerprint is invalid input, and an unknown worktree is not found', async ({
  session,
}) => {
  const before = await session.entries('..');

  const invalid = [
    await session.send(
      edit(session, {
        kind: 'create',
        path: '../outside',
        entryKind: 'file',
      }),
    ),
    await session.send(edit(session, { kind: 'explode', path: 'README.md' })),
    await session.send(
      edit(session, { kind: 'write', path: 'README.md', text: 'x' }),
    ),
  ];
  const unknown = await session.send({
    method: 'POST',
    path: `/api/worktrees/${unknownWorktreeId}/files`,
    body: {
      kind: 'write',
      path: 'README.md',
      text: 'x',
      expectedFingerprint: unknownFingerprint,
    },
  });

  for (const response of invalid) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
  expect(await session.entries('..')).toStrictEqual(before);
  expect(await session.readFile(session.fixture.readme.path)).toBe(
    'Changed elsewhere\n',
  );
});

test('creating, moving or writing through a symbolic link out of the worktree cannot be done and touches nothing outside it', async ({
  session,
}) => {
  await session.symlink('..', 'up');
  await session.symlink(CREDENTIAL_LINK, 'escape.txt');
  const before = await session.entries('..');

  const responses = [
    await session.send(
      edit(session, {
        kind: 'create',
        path: 'up/planted.md',
        entryKind: 'file',
      }),
    ),
    await session.send(
      edit(session, {
        kind: 'move',
        path: session.fixture.readme.path,
        destination: 'up/moved.md',
      }),
    ),
    await session.send(
      edit(session, {
        kind: 'write',
        path: 'escape.txt',
        text: 'Overwritten\n',
        expectedFingerprint: unknownFingerprint,
      }),
    ),
  ];

  for (const response of responses) {
    expect(response.status).toBe(422);
    expect(response.body).toStrictEqual(unreadablePath);
  }
  expect(await session.entries('..')).toStrictEqual(before);
  expect(await session.readFile(session.fixture.readme.path)).toBe(
    'Changed elsewhere\n',
  );
});
