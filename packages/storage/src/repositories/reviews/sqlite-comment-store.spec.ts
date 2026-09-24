import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RegisteredProject } from '@porcelain/projects/models';
import { commentStoreContract } from '@porcelain/reviews/store-contracts';
import { openStorageSession } from '../../index.ts';
import {
  createInventoryStore,
  createWorktreePresenceStore,
} from '../projects/index.ts';
import { createCommentStore } from './index.ts';

const project: RegisteredProject = {
  id: 'project',
  name: 'project',
  namedByOwner: false,
  commonDirectory: '/repositories/project/.git',
  repositoryIdentity: 'identity-project',
  available: true,
  position: 1,
};

commentStoreContract('SqliteCommentStore', (worktreeIds) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = openStorageSession(dataDirectory);
  createInventoryStore(session).save(project);
  createWorktreePresenceStore(session).save({
    rows: worktreeIds.map((worktreeId) => ({
      worktreeId,
      projectId: project.id,
      missingSince: undefined,
    })),
  });
  return {
    store: createCommentStore(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
