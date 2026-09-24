import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pairingGrantStoreContract } from '@porcelain/access/store-contracts';
import { openStorageSession } from '../../index.ts';
import { createDeviceStore, createPairingGrantStore } from './index.ts';

pairingGrantStoreContract('SqlitePairingGrantStore', () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = openStorageSession(dataDirectory);
  return {
    grants: createPairingGrantStore(session),
    devices: createDeviceStore(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
