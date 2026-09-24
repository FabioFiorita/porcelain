import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filePreferenceStoreContract } from '@porcelain/projects/store-contracts';
import { openStorageSession } from '../../index.ts';
import { createFilePreferenceStore, createInventoryStore } from './index.ts';

filePreferenceStoreContract('SqliteFilePreferenceStore', (projectIds) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = openStorageSession(dataDirectory);
  projectIds.forEach((projectId, position) =>
    createInventoryStore(session).save({
      id: projectId,
      name: projectId,
      namedByOwner: false,
      commonDirectory: `/repositories/${projectId}/.git`,
      repositoryIdentity: `identity-${projectId}`,
      available: true,
      position,
    }),
  );
  return {
    store: createFilePreferenceStore(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
