import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worktreePresenceStoreContract } from '@porcelain/projects/store-contracts';
import { openStorageSession } from '../../index.ts';
import { createWorktreePresenceStore, createInventoryStore } from './index.ts';

worktreePresenceStoreContract('SqliteWorktreePresenceStore', (projectIds) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = openStorageSession(dataDirectory, { worktreeIdLength: 32 });
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
    store: createWorktreePresenceStore(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
