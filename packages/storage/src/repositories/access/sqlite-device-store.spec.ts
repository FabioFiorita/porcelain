import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deviceStoreContract } from '@porcelain/access/store-contracts';
import { openStorageSession } from '../../index.ts';
import { createDeviceStore, createPairingGrantStore } from './index.ts';

deviceStoreContract('SqliteDeviceStore', (devices) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = openStorageSession(dataDirectory);
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
    store: createDeviceStore(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
