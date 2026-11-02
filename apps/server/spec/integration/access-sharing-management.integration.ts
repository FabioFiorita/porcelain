import { expect } from 'vitest';
import { tunnelOn } from '../kit/reads.ts';
import { issuePairing, read, waysInChange } from '../kit/requests.ts';
import { list, record, text, type Session } from '../kit/session.ts';
import { test } from '../kit/server-test.ts';

const HOST = 'porcelain.example.com';
const headers = { host: HOST, origin: 'http://app.example' };

async function manager(session: Session, allowed = true) {
  await tunnelOn(session, HOST);
  const issued = await read(session, {
    method: 'POST',
    path: '/pairings',
    target: 'owner',
    body: {
      labels: ['MacBook'],
      addresses: [session.address],
      canManageSharing: allowed,
    },
  });
  const grant = record(list(issued.grants)[0]);
  const paired = await read(session, {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    headers,
    body: { code: grant.code, platform: 'macOS' },
  });
  return {
    deviceId: text(record(paired.device).id),
    request: { auth: { bearer: text(paired.credential) }, headers },
  };
}

test('a sharing manager pairs and revokes a phone from another computer and edits a different way in', async ({
  session,
}) => {
  const { request, deviceId } = await manager(session);
  const access = await read(session, {
    ...request,
    method: 'GET',
    path: '/api/access',
  });
  expect(access.canEditIdentity).toBe(false);
  expect(
    record(list(access.devices).find((entry) => record(entry).id === deviceId)),
  ).toMatchObject({
    canManageSharing: true,
    trusted: false,
    canEditWaysIn: false,
  });
  const ownerAccess = await read(session, {
    method: 'GET',
    path: '/access',
    target: 'owner',
  });
  expect(ownerAccess.canEditIdentity).toBe(true);
  const rename = await session.send({
    ...request,
    method: 'PUT',
    path: '/api/environment/name',
    body: { name: 'Unexpected' },
  });
  expect(rename.status).toBe(403);
  const issued = await session.send({
    ...request,
    method: 'POST',
    path: '/api/pairings',
    body: {
      labels: ['Phone'],
      addresses: [session.address],
      canManageSharing: false,
    },
  });
  expect(issued.status).toBe(200);
  const grant = record(list(record(issued.body).grants)[0]);
  expect(record(grant.grant).canManageSharing).toBe(false);
  const paired = await read(session, {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code: grant.code, platform: 'iOS' },
  });
  const phoneId = text(record(paired.device).id);
  const saved = await session.send(
    await waysInChange(session, { lan: true }, request),
  );
  expect(saved.status).toBe(200);
  const protectedRoute = await session.send(
    await waysInChange(session, { cloudflare: false }, request),
  );
  expect(protectedRoute.status).toBe(409);
  const revoked = await session.send({
    ...request,
    method: 'POST',
    path: '/api/access/revoke',
    body: { id: phoneId },
  });
  expect(revoked.status).toBe(200);
  const refused = await session.send({
    method: 'GET',
    path: '/api/inventory',
    auth: { bearer: text(paired.credential) },
  });
  expect(refused.status).toBe(401);
  const remaining = await read(session, {
    ...request,
    method: 'GET',
    path: '/api/access',
  });
  expect(list(remaining.devices).map((entry) => record(entry).id)).toContain(
    deviceId,
  );
  expect(
    list(remaining.devices).map((entry) => record(entry).id),
  ).not.toContain(phoneId);
});

test('an opted-out device cannot grant itself management and old update or ways-in grants do not promote it', async ({
  session,
}) => {
  const { request, deviceId } = await manager(session, false);
  await read(session, {
    method: 'POST',
    path: '/access/trust',
    target: 'owner',
    body: { id: deviceId, trusted: true },
  });
  await read(session, {
    method: 'POST',
    path: '/access/ways-in-permission',
    target: 'owner',
    body: { id: deviceId, allowed: true },
  });
  const before = await read(session, {
    method: 'GET',
    path: '/access',
    target: 'owner',
  });
  const listing = await session.send({
    ...request,
    method: 'GET',
    path: '/api/access',
  });
  expect(listing.status).toBe(403);
  const escalation = await session.send({
    ...request,
    method: 'POST',
    path: '/api/access/management-permission',
    body: { id: deviceId, allowed: true },
  });
  expect(escalation.status).toBe(403);
  expect(
    await read(session, { method: 'GET', path: '/access', target: 'owner' }),
  ).toStrictEqual(before);
});

test('withdrawing management takes effect on the next request without revoking read access or another device', async ({
  session,
}) => {
  const { request, deviceId } = await manager(session);
  const withdrawn = await session.send({
    ...request,
    method: 'POST',
    path: '/api/access/management-permission',
    body: { id: deviceId, allowed: false },
  });
  expect(withdrawn.status).toBe(200);
  expect(withdrawn.body).toStrictEqual({ id: deviceId, allowed: false });
  const refused = await session.send({
    ...request,
    method: 'POST',
    path: '/api/pairings',
    body: { labels: ['Unexpected'], addresses: [session.address] },
  });
  expect(refused.status).toBe(403);
  const reader = await session.send({
    ...request,
    method: 'GET',
    path: '/api/inventory',
  });
  expect(reader.status).toBe(200);
  const ownerCode = await issuePairing(session, 'Other device');
  const other = await session.send({
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code: ownerCode, platform: 'Browser' },
  });
  expect(other.status).toBe(200);
});

test('management writes require authentication, validate the grant, and let the owner explicitly enable an opted-out device', async ({
  session,
}) => {
  const { deviceId, request } = await manager(session, false);
  const anonymous = await session.send({
    method: 'POST',
    path: '/api/access/management-permission',
    auth: 'none',
    body: { id: deviceId, allowed: true },
  });
  expect(anonymous.status).toBe(401);
  const before = await read(session, {
    method: 'GET',
    path: '/access',
    target: 'owner',
  });
  const malformed = await session.send({
    method: 'POST',
    path: '/access/management-permission',
    target: 'owner',
    body: { id: deviceId, allowed: 'yes' },
  });
  expect(malformed.status).toBe(400);
  const unknown = await session.send({
    method: 'POST',
    path: '/access/management-permission',
    target: 'owner',
    body: { id: 'unknown', allowed: true },
  });
  expect(unknown.status).toBe(404);
  expect(
    await read(session, { method: 'GET', path: '/access', target: 'owner' }),
  ).toStrictEqual(before);
  const allowed = await session.send({
    method: 'POST',
    path: '/access/management-permission',
    target: 'owner',
    body: { id: deviceId, allowed: true },
  });
  expect(allowed.status).toBe(200);
  const access = await session.send({
    ...request,
    method: 'GET',
    path: '/api/access',
  });
  expect(access.status).toBe(200);
});
