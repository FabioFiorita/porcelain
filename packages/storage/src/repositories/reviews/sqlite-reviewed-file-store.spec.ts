import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewedFileStoreContract } from '@porcelain/reviews/store-contracts';
import { openStorageSession } from '../../index.ts';
import {
  createInventoryStore,
  createWorktreePresenceStore,
} from '../projects/index.ts';
import { createReviewedFileStore } from './index.ts';

reviewedFileStoreContract('SqliteReviewedFileStore', (worktreeIds) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = openStorageSession(dataDirectory);
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
    store: createReviewedFileStore(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
