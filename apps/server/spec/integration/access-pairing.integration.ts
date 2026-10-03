import {
  listAccessResponseSchema,
  redeemPairingResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import {
  apiError,
  credentialForm,
  deviceCookieForm,
  invalidRequest,
} from '../kit/answers.ts';
import { issuePairing, read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import {
  list,
  record,
  type HttpRequest,
  type Session,
} from '../kit/session.ts';

const invalidLink = apiError(
  401,
  'Unauthorized',
  'This pairing link is not valid.',
);

function access(session: Session) {
  return read(session, { method: 'GET', path: '/access', target: 'owner' });
}

test('a native client redeems a pairing code, receives a working credential in the body, and the code is consumed', async ({
  session,
}) => {
  const code = await issuePairing(session, 'Phone');

  const response = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code, platform: 'iOS' },
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(redeemPairingResponseSchema),
  );
  const body = record(response.body);
  expect(body.device).toMatchObject({ label: 'Phone', platform: 'iOS' });
  expect(body.credential).toMatch(credentialForm);
  expect(response.headers['set-cookie']).toBeUndefined();
  const reading = await session.send({
    method: 'GET',
    path: '/api/inventory',
    auth: { bearer: String(body.credential) },
  });
  expect(reading.status).toBe(200);
  const owner = await access(session);
  expect(owner).toEqual(expect.schemaMatching(listAccessResponseSchema));
  expect(owner.grants).toStrictEqual([]);
  expect(
    list(owner.devices).filter(
      (device) => record(device).id === record(body.device).id,
    ),
  ).toMatchObject([body.device]);
});

test('a browser redeems a pairing code under its own label and receives the credential only as an HttpOnly device cookie', async ({
  session,
}) => {
  const code = await issuePairing(session, 'Laptop');

  const response = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers: { 'x-porcelain-browser': '1' },
    body: { code, platform: 'Browser', label: 'Work laptop' },
  });

  expect(response.status).toBe(200);
  const body = record(response.body);
  expect(body.device).toMatchObject({
    label: 'Work laptop',
    platform: 'Browser',
  });
  expect(Object.keys(body)).toStrictEqual(['device']);
  expect(response.headers['set-cookie']).toMatch(deviceCookieForm);
});

test('redeeming a pairing code a second time is refused without saying why', async ({
  session,
}) => {
  const code = await issuePairing(session);
  await session.read({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code, platform: 'Once' },
  });

  const response = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code, platform: 'Twice' },
  });

  expect(response.status).toBe(401);
  expect(response.body).toStrictEqual(invalidLink);
});

test('a control-character platform or a blank device name is refused without consuming the code', async ({
  session,
}) => {
  const code = await issuePairing(session, 'Watch');

  const controlCharacter = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code, platform: 'watchOS\u0007' },
  });
  const blankName = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code, platform: 'watchOS', label: '   ' },
  });
  const redeemed = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code, platform: 'watchOS' },
  });

  const refusal = apiError(
    400,
    'Bad Request',
    'The device name or platform is missing, too long, or contains control characters.',
  );
  expect([controlCharacter.status, blankName.status]).toStrictEqual([400, 400]);
  expect([controlCharacter.body, blankName.body]).toStrictEqual([
    refusal,
    refusal,
  ]);
  expect(redeemed.status).toBe(200);
  expect(record(redeemed.body).device).toMatchObject({
    label: 'Watch',
    platform: 'watchOS',
  });
});

test('redeeming a pairing code the server never issued is refused without saying why', async ({
  session,
}) => {
  const response = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code: 'pcp_unknown', platform: 'iOS' },
  });

  expect(response.status).toBe(401);
  expect(response.body).toStrictEqual(invalidLink);
});

test('a pairing request with an empty code, no platform, an extra field or malformed JSON is refused', async ({
  session,
}) => {
  const requests: HttpRequest[] = [
    {
      method: 'POST',
      path: '/api/pair',
      auth: 'none',
      body: { code: '', platform: 'iOS' },
    },
    {
      method: 'POST',
      path: '/api/pair',
      auth: 'none',
      body: { code: 'pcp_x' },
    },
    {
      method: 'POST',
      path: '/api/pair',
      auth: 'none',
      body: { code: 'pcp_x', platform: 'iOS', extra: true },
    },
    {
      method: 'POST',
      path: '/api/pair',
      auth: 'none',
      rawBody: '{',
      contentType: 'application/json',
    },
  ];
  const responses = [];
  for (const request of requests) responses.push(await session.send(request));

  expect(responses.map((response) => response.status)).toStrictEqual([
    400, 400, 400, 400,
  ]);
  expect(responses.map((response) => response.body)).toStrictEqual([
    invalidRequest,
    invalidRequest,
    invalidRequest,
    invalidRequest,
  ]);
});
