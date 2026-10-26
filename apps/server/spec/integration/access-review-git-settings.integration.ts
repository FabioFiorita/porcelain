import * as Schema from 'effect/Schema';
import {
  readReviewGitSettingsResponseSchema,
  saveReviewGitSettingsResponseSchema,
} from '@porcelain/contracts/access';
import { expect } from 'vitest';
import { apiError, invalidRequest, unauthenticated } from '../kit/answers.ts';
import { watching } from '../kit/reads.ts';
import { pairDevice, read } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import type { HttpRequest, Session } from '../kit/session.ts';

const SETTINGS_PATH = '/api/review-git-settings';
const APP = 'http://app.example';
const imported = {
  pullStrategy: 'merge',
  collapseSpecs: false,
  archiveDeleteWorktree: true,
  archiveDeleteLocalBranch: true,
  archiveDeleteRemoteBranch: true,
};
const trustRequired = apiError(
  403,
  'Forbidden',
  'An owner must trust this device on the computer that runs Porcelain before it can change Reviews & Git settings',
);
const notConfigured = apiError(
  409,
  'Conflict',
  'Choose Reviews & Git settings for this computer before changing one of them',
);

const current: HttpRequest = { method: 'GET', path: SETTINGS_PATH };
function save(
  body: unknown,
  request: Omit<HttpRequest, 'method' | 'path' | 'body'> = {},
): HttpRequest {
  return { method: 'PATCH', path: SETTINGS_PATH, body, ...request };
}
const fromPhone = (credential: string) => ({
  auth: { bearer: credential },
  headers: { origin: APP },
});

async function trustedDevice(session: Session, label: string) {
  const device = await pairDevice(session, label);
  await read(session, {
    method: 'POST',
    path: '/access/trust',
    target: 'owner',
    body: { id: device.deviceId, trusted: true },
  });
  return device;
}

test('a computer starts unconfigured, refuses a single change, and the first import configures it for live viewers', async ({
  session,
}) => {
  const before = await session.send(current);
  const early = await session.send(
    save({ kind: 'change', change: { collapseSpecs: true } }),
  );
  const connection = await watching(session);

  const response = await session.send(
    save({ kind: 'initialize', settings: imported }),
  );

  expect(before.status).toBe(200);
  expect(before.body).toStrictEqual({ kind: 'unconfigured' });
  expect(early.status).toBe(409);
  expect(early.body).toStrictEqual(notConfigured);
  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(saveReviewGitSettingsResponseSchema),
      ),
    ),
  );
  expect(response.body).toStrictEqual({
    kind: 'configured',
    revision: 1,
    settings: imported,
  });
  expect(await read(session, current)).toStrictEqual(response.body);
  expect(
    await connection.next((entry) => entry.type === 'inventory'),
  ).toStrictEqual({ type: 'inventory' });
});

test('a later import keeps the settings the computer already has', async ({
  session,
}) => {
  const configured = await read(
    session,
    save({ kind: 'initialize', settings: imported }),
  );

  const later = await session.send(
    save({
      kind: 'initialize',
      settings: { ...imported, pullStrategy: 'rebase', collapseSpecs: true },
    }),
  );

  expect(later.status).toBe(200);
  expect(later.body).toStrictEqual(configured);
  expect(await read(session, current)).toStrictEqual(configured);
});

test('two devices changing different settings both keep their change', async ({
  session,
}) => {
  const phone = await trustedDevice(session, 'Phone');
  await read(session, save({ kind: 'initialize', settings: imported }));
  const base = await read(
    session,
    save({ kind: 'change', change: imported }),
  );

  const fromHere = await session.send(
    save({ kind: 'change', change: { pullStrategy: 'rebase' } }),
  );
  const fromAway = await session.send(
    save(
      { kind: 'change', change: { archiveDeleteRemoteBranch: false } },
      fromPhone(phone.credential),
    ),
  );
  const seenByPhone = await session.send({
    ...current,
    ...fromPhone(phone.credential),
  });

  expect([fromHere.status, fromAway.status, seenByPhone.status]).toStrictEqual(
    [200, 200, 200],
  );
  const merged = {
    kind: 'configured',
    revision: Number(base.revision) + 2,
    settings: {
      ...imported,
      pullStrategy: 'rebase',
      archiveDeleteRemoteBranch: false,
    },
  };
  expect(fromAway.body).toStrictEqual(merged);
  expect(seenByPhone.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readReviewGitSettingsResponseSchema),
      ),
    ),
  );
  expect(seenByPhone.body).toStrictEqual(merged);
});

test('an untrusted device reads the settings but cannot change them, from another origin or through a relay', async ({
  session,
}) => {
  const phone = await pairDevice(session, 'Untrusted phone');
  const configured = await read(
    session,
    save({ kind: 'initialize', settings: imported }),
  );

  const reading = await session.send({
    ...current,
    ...fromPhone(phone.credential),
  });
  const changing = await session.send(
    save(
      { kind: 'change', change: { collapseSpecs: true } },
      fromPhone(phone.credential),
    ),
  );
  const relayed = await session.send(
    save(
      { kind: 'change', change: { collapseSpecs: true } },
      { headers: { 'x-forwarded-for': '203.0.113.9' } },
    ),
  );

  expect(reading.status).toBe(200);
  expect(reading.body).toStrictEqual(configured);
  expect(changing.status).toBe(403);
  expect(changing.body).toStrictEqual(trustRequired);
  expect(relayed.status).toBe(403);
  expect(relayed.body).toStrictEqual(trustRequired);
  expect(await read(session, current)).toStrictEqual(configured);
});

test('a revoked device can neither read nor change the settings', async ({
  session,
}) => {
  const phone = await trustedDevice(session, 'Lost phone');
  const before = await read(session, current);
  await read(session, {
    method: 'POST',
    path: '/access/revoke',
    target: 'owner',
    body: { id: phone.deviceId },
  });

  const reading = await session.send({
    ...current,
    ...fromPhone(phone.credential),
  });
  const changing = await session.send(
    save(
      { kind: 'initialize', settings: imported },
      fromPhone(phone.credential),
    ),
  );

  expect([reading.status, changing.status]).toStrictEqual([401, 401]);
  expect(changing.body).toStrictEqual(unauthenticated);
  expect(await read(session, current)).toStrictEqual(before);
});

test.for([
  { name: 'an empty change', body: { kind: 'change', change: {} } },
  {
    name: 'an unknown setting',
    body: { kind: 'change', change: { theme: 'dark' } },
  },
  {
    name: 'an unknown pull strategy',
    body: { kind: 'change', change: { pullStrategy: 'squash' } },
  },
  {
    name: 'a setting that is not a boolean',
    body: { kind: 'change', change: { collapseSpecs: 'yes' } },
  },
  {
    name: 'an import missing a setting',
    body: {
      kind: 'initialize',
      settings: { ...imported, archiveDeleteWorktree: undefined },
    },
  },
  {
    name: 'an unknown kind',
    body: { kind: 'replace', settings: imported },
  },
  {
    name: 'an extra field',
    body: { kind: 'initialize', settings: imported, expectedRevision: 0 },
  },
])('$name is refused and saves nothing', async ({ body }, { session }) => {
  const before = await read(session, current);

  const response = await session.send(save(body));

  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(invalidRequest);
  expect(await read(session, current)).toStrictEqual(before);
});
