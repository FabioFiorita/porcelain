import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deviceStoreContract } from '@porcelain/access/store-contracts';
import { openStorageSession } from '@porcelain/storage';
import {
  createDeviceStore,
  createPairingGrantStore,
} from '@porcelain/storage/access';
import { CachedDeviceStore } from './cached-device-store.ts';

deviceStoreContract('CachedDeviceStore over SQLite', (devices) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-cached-device-'));
  const session = openStorageSession(dataDirectory, { worktreeIdLength: 32 });
  devices.forEach((device) =>
    createPairingGrantStore(session).redeem({
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
  );
  return {
    store: new CachedDeviceStore(createDeviceStore(session)),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
