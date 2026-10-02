import {
  readServiceUpdateResponseSchema,
  startServiceUpdateResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError, invalidRequest } from '../kit/answers.ts';
import { eventually } from '../kit/reads.ts';
import { read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, text, type HttpRequest } from '../kit/session.ts';

const UPDATE_PATH = '/api/service/update';
const status: HttpRequest = { method: 'GET', path: UPDATE_PATH };
const notOffered = apiError(
  409,
  'Conflict',
  'That version is not the newer version this server offers',
);
const alreadyRunning = apiError(
  409,
  'Conflict',
  'An update is already running',
);
const untrusted = apiError(
  403,
  'Forbidden',
  'An owner must trust this device on the computer that runs Porcelain before it can update Porcelain',
);

function start(
  version: unknown,
  headers?: Record<string, string>,
): HttpRequest {
  return {
    method: 'POST',
    path: UPDATE_PATH,
    body: { version },
    ...(headers ? { headers } : {}),
  };
}

function settled(body: Record<string, unknown>) {
  return body.running === false;
}

test('the server offers its newer version while nothing runs and this browser may update', async ({
  session,
}) => {
  const response = await session.send(status);

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(readServiceUpdateResponseSchema),
  );
  expect(response.body).toMatchObject({
    managed: true,
    available: true,
    running: false,
    last: null,
    canUpdate: true,
  });
});

test('updating to a version other than the offered one, with a malformed body or by a relayed request from an untrusted device is refused and starts nothing', async ({
  session,
}) => {
  const before = await read(session, status);

  const responses = [
    await session.send(start('99.0.0')),
    await session.send(start('')),
    await session.send(
      start(before.latest, { 'x-forwarded-for': '203.0.113.9' }),
    ),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([409, 400, 403]);
  expect(responses[0]?.body).toStrictEqual(notOffered);
  expect(responses[1]?.body).toStrictEqual(invalidRequest);
  expect(responses[2]?.body).toStrictEqual(untrusted);
  expect(await read(session, status)).toStrictEqual(before);
});

test('an update that fails runs one at a time, says why and keeps the running version', async ({
  session,
}) => {
  const before = await read(session, status);

  const responses = [
    await session.send(start(before.latest)),
    await session.send(start(before.latest)),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([202, 409]);
  expect(responses[0]?.body).toEqual(
    expect.schemaMatching(startServiceUpdateResponseSchema),
  );
  expect(responses[0]?.body).toMatchObject({
    running: true,
    last: {
      from: before.version,
      target: before.latest,
      stage: 'downloading',
    },
  });
  expect(responses[1]?.body).toStrictEqual(alreadyRunning);
  const ended = await eventually(session, status, settled);
  expect(ended).toMatchObject({
    version: before.version,
    available: true,
    last: { target: before.latest, stage: 'failed' },
  });
  expect(text(record(ended.last).reason)).toMatch(/\S/u);
});

test('an update that succeeds ends on the new version with nothing newer offered', async ({
  session,
}) => {
  const before = await read(session, status);

  const response = await session.send(start(before.latest));

  expect(response.status).toBe(202);
  expect(response.body).toMatchObject({
    running: true,
    last: { stage: 'downloading' },
  });
  const ended = await eventually(session, status, settled);
  expect(ended).toStrictEqual({
    managed: true,
    version: before.latest,
    latest: before.latest,
    available: false,
    running: false,
    last: {
      from: before.version,
      target: before.latest,
      stage: 'updated',
      reason: null,
    },
    canUpdate: true,
  });
});
