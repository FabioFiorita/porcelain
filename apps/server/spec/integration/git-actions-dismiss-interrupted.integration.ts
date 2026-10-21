import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { readServerSettings } from '../../src/config/server-settings.ts';
import { apiError, invalidRequest, UNKNOWN_UUID } from '../kit/answers.ts';
import { expectation, fingerprintOf, settledReceipt } from '../kit/reads.ts';
import { gitPath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';

const mismatch = apiError(
  409,
  'Conflict',
  'Git action request does not match its receipt',
);

test('ordinary fixtures inherit the production Git action deadline', async ({
  server,
}) => {
  const production = readServerSettings({
    dataDirectory: resolve(server.projectHome, 'state'),
    projectHome: server.projectHome,
    port: 0,
    webRoot: resolve(server.projectHome, 'web'),
  });

  expect(production.limits.gitActions.deadlineMs).toBe(120000);
  expect(server.fixture.gitActionDeadlineMs).toBe(120000);
  expect(server.fixture.gitActionDeadlineMs).toBe(
    production.limits.gitActions.deadlineMs,
  );
});

test('dismissing an interruption for a request the server does not know is not found', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: gitPath(session, `/interrupted/${UNKNOWN_UUID}`),
  });

  expect(response.status).toBe(404);
  expect(response.body).toStrictEqual(
    apiError(404, 'Not Found', 'Git action receipt not found'),
  );
});

test('dismissing an interruption for a request that was not interrupted is a mismatch conflict', async ({
  session,
}) => {
  const path = 'note.txt';
  await session.writeFile(path, 'A note\n');
  const requestId = randomUUID();
  await session.read(
    {
      method: 'POST',
      path: gitPath(session, '/actions'),
      body: {
        requestId,
        input: {
          action: 'commit',
          message: 'Keep a note',
          paths: [path],
        },
        expected: {
          ...(await expectation(session)),
          files: [{ path, fingerprint: await fingerprintOf(session, path) }],
        },
      },
    },
    202,
  );
  await settledReceipt(session, requestId);

  const response = await session.send({
    method: 'DELETE',
    path: gitPath(session, `/interrupted/${requestId}`),
  });

  expect(response.status).toBe(409);
  expect(response.body).toStrictEqual(mismatch);
});

test('dismissing an interruption with a malformed request id is refused', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: gitPath(session, '/interrupted/not-a-uuid'),
  });

  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(invalidRequest);
});
