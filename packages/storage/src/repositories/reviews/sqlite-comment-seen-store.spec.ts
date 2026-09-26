import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commentSeenStoreContract } from '@porcelain/reviews/store-contracts';
import { openStorageSession } from '../../index.ts';
import {
  createInventoryStore,
  createWorktreePresenceStore,
} from '../projects/index.ts';
import { createCommentSeenStore } from './index.ts';

commentSeenStoreContract('SqliteCommentSeenStore', (worktreeIds) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = openStorageSession(dataDirectory, { worktreeIdLength: 32 });
  createInventoryStore(session).save({
    id: 'project',
    name: 'project',
    namedByOwner: false,
    commonDirectory: '/repositories/project/.git',
    repositoryIdentity: 'identity-project',
    available: true,
    position: 1,
  });
  createWorktreePresenceStore(session).save({
    rows: worktreeIds.map((worktreeId) => ({
      worktreeId,
      projectId: 'project',
      missingSince: undefined,
    })),
  });
  return {
    store: createCommentSeenStore(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
