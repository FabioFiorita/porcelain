import { expect } from 'vitest';
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
