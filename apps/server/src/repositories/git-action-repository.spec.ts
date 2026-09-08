import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import type {
  GitActionPreparation,
  GitActionReceipt,
} from '../models/git-action.ts';
import { GitActionRepository } from './git-action-repository.ts';

it('consumes preparations once, rejects changed bindings, and never replays after restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-action-receipts-'));
  const database = openDatabase(directory);
  const preparation: GitActionPreparation = {
    id: 'preparation',
    projectId: 'project',
    worktreeId: 'worktree',
    expiresAt: Date.now() + 300_000,
    intent: { action: 'commit', message: 'message' },
    fingerprint: 'fingerprint',
    preview: {
      headOid: null,
      branch: 'refs/heads/main',
      staged: true,
      trackedChanges: false,
      untrackedCount: 0,
    },
  };
  const receipt: GitActionReceipt = {
    requestId: 'request',
    preparationId: preparation.id,
    projectId: 'project',
    worktreeId: 'worktree',
    action: 'commit',
    state: 'running',
    refreshRequired: false,
    acceptedAt: Date.now(),
  };
  try {
    const store = new GitActionRepository(database.db);
    store.savePreparation(preparation);
    expect(store.accept(receipt).created).toBe(true);
    expect(store.accept(receipt)).toEqual({ receipt, created: false });
    expect(() =>
      store.accept({ ...receipt, worktreeId: 'different' }),
    ).toThrow();
    expect(() =>
      store.accept({ ...receipt, requestId: 'different' }),
    ).toThrow();
  } finally {
    database.close();
  }
  const reopened = openDatabase(directory);
  try {
    const store = new GitActionRepository(reopened.db);
    store.recover();
    expect(store.receipt('request')).toMatchObject({
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
    });
    expect(store.accept(receipt).created).toBe(false);
    expect(() =>
      store.accept({ ...receipt, requestId: 'new-request' }),
    ).toThrow();
  } finally {
    reopened.close();
    await rm(directory, { recursive: true, force: true });
  }
});
