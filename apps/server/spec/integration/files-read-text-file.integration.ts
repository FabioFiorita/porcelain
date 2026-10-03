import { readTextFileResponseSchema } from '@porcelain/contracts/files';
import { TEXT_BYTES } from '@porcelain/contracts/shared';
import { expect } from 'vitest';
import {
  apiError,
  CREDENTIAL_LINK,
  invalidRequest,
  unknownWorktreeId,
  unreadablePath,
  worktreeNotFound,
} from '../kit/answers.ts';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { type HttpRequest, type Session } from '../kit/session.ts';

const text = (session: Session, path: string): HttpRequest => ({
  method: 'GET',
  path: worktreePath(session, '/text'),
  query: { path },
});

test('reading a text file answers it as on disk with a fingerprint that stays with the content and moves when it changes', async ({
  session,
}) => {
  const seen = await read(session, text(session, session.fixture.readme.path));

  const first = await session.send(text(session, session.fixture.readme.path));
  const second = await session.send(text(session, session.fixture.readme.path));

  expect([first.status, second.status]).toStrictEqual([200, 200]);
  expect(first.body).toEqual(expect.schemaMatching(readTextFileResponseSchema));
  expect(first.body).toStrictEqual({
    worktreeId: session.worktreeId,
    path: session.fixture.readme.path,
    encoding: 'utf-8',
    byteLength: Buffer.byteLength(session.fixture.readme.changed),
    text: session.fixture.readme.changed,
    contentFingerprint: seen.contentFingerprint,
  });
  expect(second.body).toStrictEqual(first.body);
  await session.writeFile(session.fixture.readme.path, 'Edited\n');
  const edited = await read(
    session,
    text(session, session.fixture.readme.path),
  );
  expect(edited.contentFingerprint).not.toStrictEqual(seen.contentFingerprint);
  await session.writeFile(
    session.fixture.readme.path,
    session.fixture.readme.changed,
  );
});

test('reading a file that is not UTF-8 text is refused as unsupported text', async ({
  session,
}) => {
  await session.writeFile(
    'image.bin',
    new Uint8Array([0xff, 0xfe, 0x00, 0x01]),
  );

  const response = await session.send(text(session, 'image.bin'));

  expect(response.status).toBe(422);
  expect(response.body).toStrictEqual(
    apiError(
      422,
      'Unprocessable Entity',
      'File is not supported UTF-8 text',
      'unsupported_text',
    ),
  );
});

test('reading a file beyond the text read limit is refused as too large', async ({
  session,
}) => {
  await session.writeFile('large.txt', 'a'.repeat(TEXT_BYTES + 1));

  const response = await session.send(text(session, 'large.txt'));

  expect(response.status).toBe(422);
  expect(response.body).toStrictEqual(
    apiError(
      422,
      'Unprocessable Entity',
      'File exceeds the read limit',
      'file_too_large',
    ),
  );
});

test('reading a file that does not exist is not found', async ({ session }) => {
  const response = await session.send(text(session, 'missing.md'));

  expect(response.status).toBe(404);
  expect(response.body).toStrictEqual(
    apiError(404, 'Not Found', 'Path not found'),
  );
});

test('reading an escaping path, an absolute path or the root is invalid input, and reading from an unknown worktree is not found', async ({
  session,
}) => {
  const invalid = [
    await session.send(text(session, '../credential.json')),
    await session.send(text(session, '/etc/passwd')),
    await session.send(text(session, '')),
  ];
  const unknown = await session.send({
    method: 'GET',
    path: `/api/worktrees/${unknownWorktreeId}/text`,
    query: { path: 'README.md' },
  });

  for (const response of invalid) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
});

test('reading through a symbolic link cannot be done whether the link leaves the worktree or not', async ({
  session,
}) => {
  await session.symlink(CREDENTIAL_LINK, 'escape.txt');
  await session.symlink(session.fixture.readme.path, 'inside.md');

  const escaping = await session.send(text(session, 'escape.txt'));
  const inside = await session.send(text(session, 'inside.md'));

  expect(escaping.status).toBe(422);
  expect(escaping.body).toStrictEqual(unreadablePath);
  expect(inside.status).toBe(422);
  expect(inside.body).toStrictEqual(unreadablePath);
});
