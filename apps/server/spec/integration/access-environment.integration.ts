import { readEnvironmentResponseSchema } from '@porcelain/contracts/access';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { expect } from 'vitest';
import { inventory } from '../kit/reads.ts';
import { read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, type Session } from '../kit/session.ts';

async function known(session: Session) {
  const listed = await inventory(session);
  const update = await read(session, {
    method: 'GET',
    path: '/api/service/update',
  });
  return {
    environmentId: listed.environmentId,
    name: record(listed.environment).name,
    version: update.version,
  };
}

test('anyone asks which environment the server is without a credential', async ({
  session,
}) => {
  const before = await known(session);

  const response = await session.send({
    method: 'GET',
    path: '/api/environment',
    auth: 'none',
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(readEnvironmentResponseSchema),
  );
  expect(response.body).toStrictEqual({
    environmentId: before.environmentId,
    name: before.name,
    version: before.version,
    protocol: ENVIRONMENT_PROTOCOL,
  });
});

test('the environment descriptor follows a rename, keeps its id and ignores an unknown credential', async ({
  session,
}) => {
  const before = await known(session);

  const renamed = await session.send({
    method: 'PUT',
    path: '/api/environment/name',
    body: { name: 'Headless box' },
  });
  const described = await session.send({
    method: 'GET',
    path: '/api/environment',
    auth: { bearer: 'pcd_not-a-device' },
  });

  expect(renamed.status).toBe(200);
  expect(renamed.body).toStrictEqual({ name: 'Headless box', custom: true });
  expect(described.status).toBe(200);
  expect(described.body).toStrictEqual({
    environmentId: before.environmentId,
    name: 'Headless box',
    version: before.version,
    protocol: ENVIRONMENT_PROTOCOL,
  });
});
