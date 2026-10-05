import * as Schema from 'effect/Schema';
import { browseProjectFoldersResponseSchema } from '@porcelain/contracts/projects';
import { expect } from 'vitest';
import { apiError, invalidRequest } from '../kit/answers.ts';
import { test } from '../kit/server-test.ts';

test('browsing without a path lists the project home with its parent and subfolders', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/projects/folders',
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(browseProjectFoldersResponseSchema),
      ),
    ),
  );
  expect(response.body).toStrictEqual({
    path: session.projectHome,
    parent:
      session.projectHome.slice(0, session.projectHome.lastIndexOf('/')) || '/',
    directories: Object.values(session.fixture.folders)
      .sort()
      .map((name) => ({
        name,
        path: `${session.projectHome}/${name}`,
      })),
    repository: false,
    truncated: false,
  });
});

test('browsing a repository folder says it is a repository', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/projects/folders',
    query: { path: session.repository },
  });

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    path: session.repository,
    parent: session.projectHome,
    repository: true,
    directories: [],
  });
});

test('browsing an absolute folder outside the project home lists it like any other', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: '/api/projects/folders',
    query: { path: session.installation },
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    path: session.installation,
    parent: session.installation.slice(
      0,
      session.installation.lastIndexOf('/'),
    ),
    directories: [
      { name: 'bin', path: `${session.installation}/bin` },
      { name: 'server', path: `${session.installation}/server` },
    ],
    repository: false,
    truncated: false,
  });
});

test('browsing a relative path is invalid input and browsing a missing folder is not found', async ({
  session,
}) => {
  const relative = await session.send({
    method: 'GET',
    path: '/api/projects/folders',
    query: { path: 'relative' },
  });
  const missing = await session.send({
    method: 'GET',
    path: '/api/projects/folders',
    query: { path: `${session.projectHome}/missing` },
  });

  expect(relative.status).toBe(400);
  expect(relative.body).toStrictEqual(invalidRequest);
  expect(missing.status).toBe(404);
  expect(missing.body).toStrictEqual(
    apiError(404, 'Not Found', 'Path not found'),
  );
});
