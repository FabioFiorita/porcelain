import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitActionReceipt } from '@porcelain/git-actions/models';
import { gitActionReceiptStoreContract } from '@porcelain/git-actions/store-contracts';
import { openStorageSession, type StorageSession } from '../../index.ts';
import {
  createInventoryStore,
  createWorktreePresenceStore,
} from '../projects/index.ts';
import { createGitActionStore } from './index.ts';

function openScoped(projectId: string, worktreeIds: readonly string[]) {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = openStorageSession(dataDirectory);
  createInventoryStore(session).save({
    id: projectId,
    name: projectId,
    namedByOwner: false,
    commonDirectory: `/repositories/${projectId}/.git`,
    repositoryIdentity: `identity-${projectId}`,
    available: true,
    position: 1,
  });
  createWorktreePresenceStore(session).save({
    rows: worktreeIds.map((worktreeId) => ({
      worktreeId,
      projectId,
      missingSince: undefined,
    })),
  });
  return {
    session,
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
}

gitActionReceiptStoreContract(
  'SqliteGitActionReceiptStore',
  ({ projectId, worktreeIds }) => {
    const { session, close } = openScoped(projectId, worktreeIds);
    return { store: createGitActionStore(session), close };
  },
);

function receipt(requestId: string, worktreeId: string): GitActionReceipt {
  return {
    requestId,
    projectId: 'project',
    worktreeId,
    action: 'fetch',
    intent: { action: 'fetch', remoteName: 'origin', sourceRef: 'main' },
    expected: {},
    state: 'interrupted',
    reason: 'OUTCOME_UNKNOWN',
    progress: [],
    refreshRequired: true,
    acceptedAt: '2026-09-23T09:00:00.000Z',
    finishedAt: '2026-09-23T10:00:00.000Z',
  };
}

describe('SqliteGitActionReceiptStore collection', () => {
  let opened: { session: StorageSession; close: () => void };

  beforeEach(() => {
    opened = openScoped('project', ['collected', 'kept']);
  });

  afterEach(() => {
    opened.close();
  });

  it('removes the receipts of a worktree when the worktree is collected, and keeps the others', () => {
    const store = createGitActionStore(opened.session);
    store.insert(receipt('collected', 'collected'));
    store.insert(receipt('kept', 'kept'));
    createWorktreePresenceStore(opened.session).remove({
      worktreeIds: ['collected'],
    });
    expect(store.read({ requestId: 'collected' })).toBeUndefined();
    expect(
      store.latestInterrupted({ worktreeId: 'collected' }),
    ).toBeUndefined();
    expect(store.read({ requestId: 'kept' })).toEqual(receipt('kept', 'kept'));
  });
});
