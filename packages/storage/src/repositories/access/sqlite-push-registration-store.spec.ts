import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  PairingGrantStore,
  PushRegistrationStore,
} from '@porcelain/access/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pushRegistrationStoreContract } from '@porcelain/access/store-contracts';

function open(dataDirectory: string) {
  return ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
}

async function pair(session: ReturnType<typeof open>, id: string) {
  const createdAt = '2026-11-01T10:00:00.000Z';
  await Effect.runPromise(
    (await session.runPromise(PairingGrantStore)).redeem({
      grant: {
        id: `grant-${id}`,
        label: id,
        addresses: [],
        createdAt,
        expiresAt: createdAt,
        secretHash: `grant-hash-${id}`,
      },
      redeemedAt: createdAt,
      device: {
        id,
        label: id,
        platform: 'iOS',
        createdAt,
        lastSeenAt: createdAt,
        route: 'lan',
        secretHash: `hash-${id}`,
      },
    }),
  );
}

pushRegistrationStoreContract('SqlitePushRegistrationStore', async () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = open(dataDirectory);
  await pair(session, 'phone');
  await pair(session, 'tablet');
  return {
    store: await session.runPromise(PushRegistrationStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});

describe('SqlitePushRegistrationStore persistence', () => {
  let dataDirectory: string;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  });

  afterEach(() => {
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('keeps a device registration when the data directory is opened again', async () => {
    const registration = {
      deviceId: 'phone',
      token: 'ExponentPushToken[phone]',
      platform: 'android' as const,
      kinds: [],
    };
    const first = open(dataDirectory);
    await pair(first, 'phone');
    await Effect.runPromise(
      (await first.runPromise(PushRegistrationStore)).save(registration),
    );
    await first.dispose();

    const second = open(dataDirectory);
    const reopened = await Effect.runPromise(
      (await second.runPromise(PushRegistrationStore)).list(),
    );
    await second.dispose();

    expect(reopened).toEqual([registration]);
  });
});
