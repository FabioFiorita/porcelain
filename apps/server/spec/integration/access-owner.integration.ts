import * as Schema from 'effect/Schema';
import {
  issuePairingResponseSchema,
  listAccessResponseSchema,
  readOwnerStatusResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  pairingLinkForm,
  unauthenticated,
} from '../kit/answers.ts';
import { inventory } from '../kit/reads.ts';
import { mcpHeaders, pairDevice, read, owner } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text, type HttpRequest } from '../kit/session.ts';

const ownerAccess = owner({ method: 'GET', path: '/access' });

test('the owner socket reports where the server runs and is never cached', async ({
  session,
}) => {
  const response = await session.send(
    owner({ method: 'GET', path: '/status' }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readOwnerStatusResponseSchema),
      ),
    ),
  );
  expect(record(response.body).address).toBe(session.address);
  expect(response.headers['cache-control']).toBe('no-store');
});

test('the owner lists no open pairing grants and the paired fixture device', async ({
  session,
}) => {
  const response = await session.send(ownerAccess);

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(listAccessResponseSchema)),
    ),
  );
  expect(record(response.body).grants).toStrictEqual([]);
  expect(
    list(record(response.body).devices).map((device) => ({
      label: record(device).label,
      platform: record(device).platform,
    })),
  ).toStrictEqual([session.fixture.device]);
});

test('the owner issues a pairing whose link opens the pairing page and which is then listed', async ({
  session,
}) => {
  const response = await session.send(
    owner({
      method: 'POST',
      path: '/pairings',
      body: { labels: ['Tablet'], addresses: [session.address] },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(issuePairingResponseSchema)),
    ),
  );
  const grant = record(list(record(response.body).grants)[0]);
  expect(grant.grant).toMatchObject({
    label: 'Tablet',
    addresses: [session.address],
  });
  expect(grant.link).toMatch(
    pairingLinkForm(
      session.address,
      text((await inventory(session)).environmentId),
    ),
  );
  const access = await read(session, ownerAccess);
  expect(access).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(listAccessResponseSchema)),
    ),
  );
  expect(list(access.grants).map((entry) => record(entry).id)).toStrictEqual([
    record(grant.grant).id,
  ]);
});

test('issuing a pairing with no labels or a malformed address is refused', async ({
  session,
}) => {
  const empty = await session.send(
    owner({
      method: 'POST',
      path: '/pairings',
      body: { labels: [], addresses: [] },
    }),
  );
  const malformed = await session.send(
    owner({
      method: 'POST',
      path: '/pairings',
      body: { labels: ['x'], addresses: ['not a url'] },
    }),
  );

  expect([empty.status, malformed.status]).toStrictEqual([400, 400]);
  expect([empty.body, malformed.body]).toStrictEqual([
    invalidRequest,
    invalidRequest,
  ]);
});

test('issuing a pairing for an address the server does not answer at, or with a blank label, issues nothing', async ({
  session,
}) => {
  const before = await read(session, ownerAccess);

  const unreachable = await session.send(
    owner({
      method: 'POST',
      path: '/pairings',
      body: {
        labels: ['Tablet'],
        addresses: [session.address, 'http://192.0.2.1:9'],
      },
    }),
  );
  const blank = await session.send(
    owner({
      method: 'POST',
      path: '/pairings',
      body: { labels: ['Tablet', ' \t '], addresses: [session.address] },
    }),
  );

  expect(unreachable.status).toBe(400);
  expect(unreachable.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      'This server does not answer at that address, so a link aimed there would not reach it.',
    ),
  );
  expect(blank.status).toBe(400);
  expect(blank.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      'The device name or platform is missing, too long, or contains control characters.',
    ),
  );
  expect(await read(session, ownerAccess)).toStrictEqual(before);
});

test('revoking a device stops its credential working while other devices keep access', async ({
  session,
}) => {
  const device = await pairDevice(session, 'Revoked device');

  const response = await session.send(
    owner({
      method: 'POST',
      path: '/access/revoke',
      body: { id: device.deviceId },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ revoked: true, kind: 'device' });
  const reading = await session.send({
    method: 'GET',
    path: '/api/inventory',
    auth: { bearer: device.credential },
  });
  expect(reading.status).toBe(401);
  expect(reading.body).toStrictEqual(unauthenticated);
  const kept = await session.send({ method: 'GET', path: '/api/inventory' });
  expect(kept.status).toBe(200);
});

test('revoking an unused pairing grant removes it from the listing', async ({
  session,
}) => {
  const before = await read(session, ownerAccess);
  const issued = await read(
    session,
    owner({
      method: 'POST',
      path: '/pairings',
      body: { labels: ['Unused'], addresses: [session.address] },
    }),
  );
  const grantId = text(record(record(list(issued.grants)[0]).grant).id);

  const response = await session.send(
    owner({
      method: 'POST',
      path: '/access/revoke',
      body: { id: grantId },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ revoked: true, kind: 'grant' });
  const access = await read(session, ownerAccess);
  expect(access.grants).toStrictEqual(before.grants);
});

test('revoking an unknown id revokes nothing and an empty id is refused', async ({
  session,
}) => {
  const unknown = await session.send(
    owner({
      method: 'POST',
      path: '/access/revoke',
      body: { id: 'unknown' },
    }),
  );
  const invalid = await session.send(
    owner({ method: 'POST', path: '/access/revoke', body: { id: '' } }),
  );

  expect(unknown.status).toBe(200);
  expect(unknown.body).toStrictEqual({ revoked: false });
  expect(invalid.status).toBe(400);
  expect(invalid.body).toStrictEqual(invalidRequest);
});

test('the owner socket serves the review MCP endpoint with its review tools', async ({
  session,
}) => {
  const initialized = await session.send(
    owner({
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders(session.repository),
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'verify', version: '1' },
        },
      },
    }),
  );
  const tools = await session.send(
    owner({
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders(session.repository),
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    }),
  );

  expect(initialized.status).toBe(200);
  expect(initialized.body).toMatchObject({
    jsonrpc: '2.0',
    id: 1,
    result: { serverInfo: { name: 'porcelain' } },
  });
  expect(tools.status).toBe(200);
  expect(
    list(record(record(tools.body).result).tools)
      .map((tool) => String(record(tool).name))
      .sort(),
  ).toStrictEqual([
    'create_comment',
    'list_comments',
    'publish_review',
    'read_review',
    'reply_to_comment',
    'resolve_comment',
  ]);
});

test('the review MCP endpoint refuses every method but POST', async ({
  session,
}) => {
  const methods: HttpRequest['method'][] = ['GET', 'PUT', 'PATCH', 'DELETE'];
  const responses = [];
  for (const method of methods)
    responses.push(await session.send(owner({ method, path: '/mcp' })));

  expect(responses.map((response) => response.status)).toStrictEqual([
    405, 405, 405, 405,
  ]);
  expect(responses.map((response) => response.body)).toStrictEqual(
    methods.map(() =>
      apiError(405, 'Method Not Allowed', 'Method Not Allowed'),
    ),
  );
  expect(responses.map((response) => response.headers.allow)).toStrictEqual([
    'POST',
    'POST',
    'POST',
    'POST',
  ]);
});

test('the network listener answers owner reads with the web shell, does not find owner writes even with a paired credential, and nothing is issued or revoked', async ({
  session,
}) => {
  const before = await read(session, ownerAccess);
  const requests: HttpRequest[] = [
    { method: 'GET', path: '/status' },
    { method: 'GET', path: '/access' },
    {
      method: 'POST',
      path: '/pairings',
      body: { labels: ['Intruder'], addresses: [session.address] },
    },
    { method: 'POST', path: '/access/revoke', body: { id: 'unknown' } },
    {
      method: 'POST',
      path: '/mcp',
      headers: mcpHeaders(session.repository),
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    },
  ];
  const responses = [];
  for (const request of requests) responses.push(await session.send(request));

  const reads = responses.slice(0, 2);
  const writes = responses.slice(2);
  expect(reads.map((response) => response.status)).toStrictEqual([200, 200]);
  expect(reads.map((response) => response.body)).toStrictEqual([
    session.fixture.web.shell,
    session.fixture.web.shell,
  ]);
  expect(writes.map((response) => response.status)).toStrictEqual([
    404, 404, 404,
  ]);
  expect(writes.map((response) => response.body)).toStrictEqual([
    apiError(404, 'Not Found', 'Route POST:/pairings not found'),
    apiError(404, 'Not Found', 'Route POST:/access/revoke not found'),
    apiError(404, 'Not Found', 'Route POST:/mcp not found'),
  ]);
  expect(await read(session, ownerAccess)).toStrictEqual(before);
});
