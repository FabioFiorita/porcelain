import { expect } from 'vitest';
import { apiError, invalidRequest, UNKNOWN_UUID } from '../kit/answers.ts';
import { inventory } from '../kit/reads.ts';
import { test } from '../kit/server-test.ts';
import { list, record } from '../kit/session.ts';

test('renaming a project trims the name and changes only that name in the inventory', async ({
  session,
}) => {
  const before = await inventory(session);
  expect(list(before.projects)).toHaveLength(1);

  const response = await session.send({
    method: 'PATCH',
    path: `/api/projects/${session.projectId}`,
    body: { name: '  New name  ' },
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    id: session.projectId,
    name: 'New name',
  });
  expect(await inventory(session)).toStrictEqual({
    ...before,
    projects: list(before.projects).map((entry) =>
      record(entry).id === session.projectId
        ? { ...record(entry), name: 'New name' }
        : entry,
    ),
  });
});

test('renaming a project the server does not know is refused and changes nothing', async ({
  session,
}) => {
  const before = await inventory(session);

  const response = await session.send({
    method: 'PATCH',
    path: `/api/projects/${UNKNOWN_UUID}`,
    body: { name: 'Ghost' },
  });

  expect(response.status).toBe(404);
  expect(response.body).toStrictEqual(
    apiError(404, 'Not Found', 'Project not found'),
  );
  expect(await inventory(session)).toStrictEqual(before);
});

test.for([
  { refusal: 'an empty name', name: '', project: undefined },
  { refusal: 'a whitespace-only name', name: '   ', project: undefined },
  {
    refusal: 'a name over 100 characters',
    name: 'x'.repeat(101),
    project: undefined,
  },
  {
    refusal: 'a control character in the name',
    name: 'Line\nbreak',
    project: undefined,
  },
  {
    refusal: 'an invalid project id',
    name: 'Valid name',
    project: 'not-a-uuid',
  },
])(
  'renaming a project refuses $refusal and changes nothing',
  async ({ name, project }, { session }) => {
    const before = await inventory(session);

    const response = await session.send({
      method: 'PATCH',
      path: `/api/projects/${project ?? session.projectId}`,
      body: { name },
    });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
    expect(await inventory(session)).toStrictEqual(before);
  },
);
