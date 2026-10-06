import { NodeServices } from '@effect/platform-node';
import { Layer, ManagedRuntime } from 'effect';
import { PairingGrantStore, DeviceStore } from '@porcelain/access/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pairingGrantStoreContract } from '@porcelain/access/store-contracts';

pairingGrantStoreContract('SqlitePairingGrantStore', async () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  return {
    grants: await session.runPromise(PairingGrantStore),
    devices: await session.runPromise(DeviceStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
