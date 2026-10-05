import * as Schema from 'effect/Schema';
import { readPreviewAssetsResponseSchema } from '@porcelain/contracts/files';
import { expect } from 'vitest';
import {
  CREDENTIAL_LINK,
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

test('a preview gets each referenced image in request order, with missing and escaping references answered as unavailable', async ({
  session,
}) => {
  await session.writeFile('logo.svg', SVG);

  const response = await session.send({
    method: 'POST',
    path: worktreePath(session, '/preview-assets'),
    body: {
      document: 'README.md',
      paths: ['logo.svg', 'missing.png', '../outside.png'],
    },
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readPreviewAssetsResponseSchema),
      ),
    ),
  );
  expect(response.body).toStrictEqual({
    assets: [
      {
        kind: 'asset',
        path: 'logo.svg',
        mediaType: 'image/svg+xml',
        base64: Buffer.from(SVG).toString('base64'),
      },
      { kind: 'unavailable', path: 'missing.png' },
      { kind: 'unavailable', path: '../outside.png' },
    ],
  });
});

test('asking for no preview assets is invalid input and asking an unknown worktree is not found', async ({
  session,
}) => {
  const invalid = await session.send({
    method: 'POST',
    path: worktreePath(session, '/preview-assets'),
    body: { document: 'README.md', paths: [] },
  });
  const unknown = await session.send({
    method: 'POST',
    path: `/api/worktrees/${unknownWorktreeId}/preview-assets`,
    body: { document: 'README.md', paths: ['logo.svg'] },
  });

  expect(invalid.status).toBe(400);
  expect(invalid.body).toStrictEqual(invalidRequest);
  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
});

test('a symbolic link out of the worktree is unavailable to a preview while the image beside it is answered', async ({
  session,
}) => {
  await session.symlink(CREDENTIAL_LINK, 'escape.svg');

  const response = await session.send({
    method: 'POST',
    path: worktreePath(session, '/preview-assets'),
    body: { document: 'README.md', paths: ['escape.svg', 'logo.svg'] },
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    assets: [
      { kind: 'unavailable', path: 'escape.svg' },
      {
        kind: 'asset',
        path: 'logo.svg',
        mediaType: 'image/svg+xml',
        base64: Buffer.from(SVG).toString('base64'),
      },
    ],
  });
});
