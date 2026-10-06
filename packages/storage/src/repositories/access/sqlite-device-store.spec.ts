import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { PairingGrantStore, DeviceStore } from '@porcelain/access/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deviceStoreContract } from '@porcelain/access/store-contracts';

deviceStoreContract('SqliteDeviceStore', async (devices) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  await Promise.all(
    devices.map(
      async (device) =>
        await Effect.runPromise(
          (await session.runPromise(PairingGrantStore)).redeem({
            grant: {
              id: `grant-${device.id}`,
              label: device.label,
              addresses: [],
              createdAt: device.createdAt,
              expiresAt: device.createdAt,
              secretHash: `grant-hash-${device.id}`,
            },
            redeemedAt: device.createdAt,
            device,
          }),
        ),
    ),
  );
  return {
    store: await session.runPromise(DeviceStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
