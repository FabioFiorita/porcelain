import { listFilePreferencesResponseSchema } from '@porcelain/contracts/projects';
import * as Schema from 'effect/Schema';
import { expect } from 'vitest';
import { invalidRequest } from '../kit/answers.ts';
import { read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';

const preferences = (projectId: string) =>
  `/api/projects/${projectId}/file-preferences`;

test('a project starts with no file preferences', async ({ session }) => {
  const response = await session.send({
    method: 'GET',
    path: preferences(session.projectId),
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ preferences: [] });
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(listFilePreferencesResponseSchema),
      ),
    ),
  );
});

test('pinning, hiding and unpinning a path keeps the other flag, accepts a path that does not exist and answers the full list', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'PUT',
      path: preferences(session.projectId),
      body: { path: 'README.md', flag: 'pinned', value: true },
    }),
    await session.send({
      method: 'PUT',
      path: preferences(session.projectId),
      body: { path: 'README.md', flag: 'hidden', value: true },
    }),
    await session.send({
      method: 'PUT',
      path: preferences(session.projectId),
      body: { path: 'README.md', flag: 'pinned', value: false },
    }),
    await session.send({
      method: 'PUT',
      path: preferences(session.projectId),
      body: { path: 'docs/missing.md', flag: 'pinned', value: true },
    }),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([
    200, 200, 200, 200,
  ]);
  expect(responses.map((entry) => entry.body)).toStrictEqual([
    { preferences: [{ path: 'README.md', pinned: true, hidden: false }] },
    { preferences: [{ path: 'README.md', pinned: true, hidden: true }] },
    { preferences: [{ path: 'README.md', pinned: false, hidden: true }] },
    {
      preferences: [
        { path: 'README.md', pinned: false, hidden: true },
        { path: 'docs/missing.md', pinned: true, hidden: false },
      ],
    },
  ]);
  expect(
    await read(session, {
      method: 'GET',
      path: preferences(session.projectId),
    }),
  ).toStrictEqual({
    preferences: [
      { path: 'README.md', pinned: false, hidden: true },
      { path: 'docs/missing.md', pinned: true, hidden: false },
    ],
  });
});

test('an escaping path, an unknown flag or an invalid project id is invalid input', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'PUT',
      path: preferences(session.projectId),
      body: { path: '../outside', flag: 'pinned', value: true },
    }),
    await session.send({
      method: 'PUT',
      path: preferences(session.projectId),
      body: { path: 'README.md', flag: 'starred', value: true },
    }),
    await session.send({ method: 'GET', path: preferences('not-a-uuid') }),
  ];

  for (const response of responses) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
});
