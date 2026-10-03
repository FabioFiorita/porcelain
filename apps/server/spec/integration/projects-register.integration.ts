import { registerProjectResponseSchema } from '@porcelain/contracts/projects';
import { expect } from 'vitest';
import { apiError, invalidRequest } from '../kit/answers.ts';
import { inventory } from '../kit/reads.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text } from '../kit/session.ts';

const byText = (left: string, right: string) => left.localeCompare(right);

const uninspectable = apiError(
  422,
  'Unprocessable Entity',
  'Repository could not be inspected',
);

test('registering a second repository names the project after its folder, lists its worktrees and adds it to the inventory', async ({
  session,
}) => {
  const path = `${session.projectHome}/second`;
  await session.git('init', '-b', 'trunk', path);

  const response = await session.send({
    method: 'POST',
    path: '/api/projects',
    body: { path },
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(registerProjectResponseSchema),
  );
  expect(response.body).toMatchObject({
    name: 'second',
    available: true,
    worktrees: [
      {
        path,
        main: true,
        branch: 'refs/heads/trunk',
        available: true,
        status: null,
      },
    ],
  });
  const projects = list((await inventory(session)).projects).map(
    (entry) => record(entry).id,
  );
  expect(projects.map(text).sort(byText)).toStrictEqual(
    [session.projectId, text(record(response.body).id)].sort(byText),
  );
});

test('registering an already registered repository returns the existing project instead of a duplicate', async ({
  session,
}) => {
  const response = await session.send({
    method: 'POST',
    path: '/api/projects',
    body: { path: session.repository },
  });

  expect(response.status).toBe(200);
  expect(record(response.body).id).toBe(session.projectId);
  expect(list((await inventory(session)).projects)).toHaveLength(2);
});

test('registering a relative path or no path at all is invalid input', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'POST',
      path: '/api/projects',
      body: { path: 'relative/folder' },
    }),
    await session.send({ method: 'POST', path: '/api/projects', body: {} }),
  ];

  for (const response of responses) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
});

test('registering a missing folder or a folder that is not a repository cannot be inspected and changes nothing', async ({
  session,
}) => {
  const before = await inventory(session);

  const responses = [
    await session.send({
      method: 'POST',
      path: '/api/projects',
      body: { path: `${session.projectHome}/missing` },
    }),
    await session.send({
      method: 'POST',
      path: '/api/projects',
      body: { path: `${session.projectHome}/home` },
    }),
  ];

  for (const response of responses) {
    expect(response.status).toBe(422);
    expect(response.body).toStrictEqual(uninspectable);
  }
  expect(await inventory(session)).toStrictEqual(before);
});
