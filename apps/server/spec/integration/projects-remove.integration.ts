import { expect } from 'vitest';
import { invalidRequest, UNKNOWN_UUID } from '../kit/answers.ts';
import { inventory } from '../kit/reads.ts';
import { test } from '../kit/server-test.ts';
import { list } from '../kit/session.ts';

test('removing a project by an invalid id is invalid input and changes nothing', async ({
  session,
}) => {
  const before = await inventory(session);

  const response = await session.send({
    method: 'DELETE',
    path: '/api/projects/not-a-uuid',
  });

  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(invalidRequest);
  expect(await inventory(session)).toStrictEqual(before);
});

test('removing a project the server does not know reports nothing deleted and changes nothing', async ({
  session,
}) => {
  const before = await inventory(session);

  const response = await session.send({
    method: 'DELETE',
    path: `/api/projects/${UNKNOWN_UUID}`,
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ deleted: false });
  expect(await inventory(session)).toStrictEqual(before);
});

test('removing a registered project deletes it and takes it out of the inventory', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: `/api/projects/${session.projectId}`,
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ deleted: true });
  expect(list((await inventory(session)).projects)).toStrictEqual([]);
});

test('removing a project that was already removed reports nothing deleted and the inventory stays empty', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: `/api/projects/${session.projectId}`,
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ deleted: false });
  expect(list((await inventory(session)).projects)).toStrictEqual([]);
});
