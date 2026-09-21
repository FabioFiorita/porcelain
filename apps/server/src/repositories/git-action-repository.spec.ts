import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { GitActionRepository } from './git-action-repository.ts';

it('keeps direct requests idempotent, queries running work, interrupts restarts, and prunes old receipts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-direct-receipts-'));
  const database = openDatabase(directory);
  const scope = { projectId: 'project', worktreeId: 'worktree' };
  const intent = { action: 'switch-branch' as const, branch: 'topic' };
  const expected = {
    headOid: null,
    branch: 'main',
    inProgress: null,
    mergeHeadOid: null,
  };
  try {
    const store = new GitActionRepository(database.db);
    const accepted = store.acceptDirect(
      scope,
      'request',
      intent,
      expected,
      'fingerprint',
    );
    expect(accepted.created).toBe(true);
    expect(store.running(scope.projectId)).toBe(true);
    expect(
      store.acceptDirect(scope, 'request', intent, expected, 'fingerprint')
        .created,
    ).toBe(false);
    expect(() =>
      store.acceptDirect(scope, 'request', intent, expected, 'different'),
    ).toThrow();
  } finally {
    database.close();
  }

  const reopened = openDatabase(directory);
  try {
    const store = new GitActionRepository(reopened.db);
    store.recover();
    expect(store.receipt('request')).toMatchObject({
      state: 'interrupted',
      reason: 'OUTCOME_UNKNOWN',
    });
    expect(store.interrupted(scope.worktreeId)).toMatchObject({
      requestId: 'request',
    });
    expect(store.running(scope.projectId)).toBe(false);
    const receipt = store.receipt('request');
    if (!receipt) throw new Error('Missing recovered receipt');
    store.dismissInterrupted(scope, 'request');
    expect(store.interrupted(scope.worktreeId)).toBeUndefined();
    expect(store.receipt('request')).toMatchObject({ state: 'interrupted' });
    store.finish({
      ...receipt,
      state: 'succeeded',
      finishedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    });
    store.recover();
    expect(store.receipt('request')).toBeUndefined();
  } finally {
    reopened.close();
    await rm(directory, { recursive: true, force: true });
  }
});
