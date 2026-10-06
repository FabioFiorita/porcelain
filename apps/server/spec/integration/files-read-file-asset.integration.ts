import * as Schema from 'effect/Schema';
import { readFileAssetResponseSchema } from '@porcelain/contracts/files';
import { expect } from 'vitest';
import {
  apiError,
  CREDENTIAL_LINK,
  invalidRequest,
  unknownWorktreeId,
  unreadablePath,
  worktreeNotFound,
} from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { type HttpRequest, type Session } from '../kit/session.ts';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';
const asset = (session: Session, path: string): HttpRequest => ({
  method: 'GET',
  path: worktreePath(session, '/asset'),
  query: { path },
});

test('reading an SVG image answers its media type and base64 content', async ({
  session,
}) => {
  await session.writeFile('logo.svg', SVG);

  const response = await session.send(asset(session, 'logo.svg'));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(readFileAssetResponseSchema)),
    ),
  );
  expect(response.body).toStrictEqual({
    path: 'logo.svg',
    mediaType: 'image/svg+xml',
    base64: Buffer.from(SVG).toString('base64'),
  });
});

test('reading a file whose type cannot be previewed is refused with a message that says so', async ({
  session,
}) => {
  const response = await session.send(asset(session, 'README.md'));

  expect(response.status).toBe(422);
  expect(response.body).toStrictEqual(
    apiError(422, 'Unprocessable Entity', 'File type cannot be previewed'),
  );
});

test('reading a missing asset is not found, an escaping path is invalid input and an unknown worktree is not found', async ({
  session,
}) => {
  const missing = await session.send(asset(session, 'missing.png'));
  const invalid = await session.send(asset(session, '../outside.png'));
  const unknown = await session.send({
    method: 'GET',
    path: `/api/worktrees/${unknownWorktreeId}/asset`,
    query: { path: 'logo.svg' },
  });

  expect(missing.status).toBe(404);
  expect(missing.body).toStrictEqual(
    apiError(404, 'Not Found', 'Path not found'),
  );
  expect(invalid.status).toBe(400);
  expect(invalid.body).toStrictEqual(invalidRequest);
  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
});

test('reading an asset through a symbolic link out of the worktree cannot be done', async ({
  session,
}) => {
  await session.symlink(CREDENTIAL_LINK, 'escape.svg');

  const response = await session.send(asset(session, 'escape.svg'));

  expect(response.status).toBe(422);
  expect(response.body).toStrictEqual(unreadablePath);
});
