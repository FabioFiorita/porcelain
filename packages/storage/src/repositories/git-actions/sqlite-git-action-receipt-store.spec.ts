import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GitActionReceipt } from '@porcelain/git-actions/models';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStorageSession, type StorageSession } from '../../index.ts';
import {
  createInventoryStore,
  createWorktreePresenceStore,
} from '../projects/index.ts';
import { createGitActionStore } from './index.ts';

const projectId = 'project';
const worktreeId = 'worktree';
const otherWorktreeId = 'other-worktree';

function receipt(
  requestId: string,
  overrides: Partial<GitActionReceipt> = {},
): GitActionReceipt {
  return {
    requestId,
    projectId,
    worktreeId,
    action: 'fetch',
    intent: { action: 'fetch', remoteName: 'origin', sourceRef: 'main' },
    expected: { upstream: {} },
    state: 'running',
    progress: [],
    refreshRequired: false,
    acceptedAt: '2026-09-23T09:00:00.000Z',
    ...overrides,
  };
}

const interrupted = (requestId: string, finishedAt: string) =>
  receipt(requestId, {
    state: 'interrupted',
    reason: 'OUTCOME_UNKNOWN',
    refreshRequired: true,
    finishedAt,
  });

describe('SqliteGitActionReceiptStore', () => {
  let dataDirectory: string;
  let session: StorageSession;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
    session = openStorageSession(dataDirectory);
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
      rows: [worktreeId, otherWorktreeId].map((id) => ({
        worktreeId: id,
        projectId,
        missingSince: undefined,
      })),
    });
  });

  afterEach(() => {
    session.close();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('reads a receipt back as it was last saved', () => {
    const store = createGitActionStore(session);
    store.insert(receipt('first'));
    store.save(
      receipt('first', {
        state: 'succeeded',
        progress: ['Receiving objects'],
        finishedAt: '2026-09-23T09:00:05.000Z',
      }),
    );
    expect(store.read({ requestId: 'first' })).toEqual(
      receipt('first', {
        state: 'succeeded',
        progress: ['Receiving objects'],
        finishedAt: '2026-09-23T09:00:05.000Z',
      }),
    );
    expect(store.running()).toEqual([]);
  });

  it('finds the latest undismissed interrupted receipt of a worktree by when it finished', () => {
    const store = createGitActionStore(session);
    store.insert(interrupted('early', '2026-09-23T09:59:59.999Z'));
    store.insert(interrupted('latest', '2026-09-23T10:00:00.000Z'));
    store.insert({
      ...interrupted('dismissed', '2026-09-23T11:00:00.000Z'),
      dismissedAt: '2026-09-23T11:30:00.000Z',
    });
    expect(store.latestInterrupted({ worktreeId })?.requestId).toBe('latest');
    expect(store.latestInterrupted({ worktreeId: 'other' })).toBeUndefined();
  });

  it('lists finished receipts with their time and removes the ones asked for', () => {
    const store = createGitActionStore(session);
    store.insert(receipt('running'));
    store.insert(interrupted('old', '2026-08-01T00:00:00.000Z'));
    store.insert(interrupted('recent', '2026-09-23T10:00:00.000Z'));
    expect(store.finished()).toHaveLength(2);
    expect(store.finished()).toEqual(
      expect.arrayContaining([
        { requestId: 'old', finishedAt: '2026-08-01T00:00:00.000Z' },
        { requestId: 'recent', finishedAt: '2026-09-23T10:00:00.000Z' },
      ]),
    );
    store.remove({ requestIds: ['old'] });
    store.remove({ requestIds: [] });
    expect(store.read({ requestId: 'old' })).toBeUndefined();
    expect(store.running().map((kept) => kept.requestId)).toEqual(['running']);
    expect(store.read({ requestId: 'recent' })).toBeDefined();
  });

  it('removes the receipts of a worktree when the worktree is collected, and keeps the others', () => {
    const store = createGitActionStore(session);
    store.insert(interrupted('collected', '2026-09-23T10:00:00.000Z'));
    store.insert({
      ...interrupted('kept', '2026-09-23T10:00:00.000Z'),
      worktreeId: otherWorktreeId,
    });
    createWorktreePresenceStore(session).remove({ worktreeIds: [worktreeId] });
    expect(store.read({ requestId: 'collected' })).toBeUndefined();
    expect(store.latestInterrupted({ worktreeId })).toBeUndefined();
    expect(
      store.latestInterrupted({ worktreeId: otherWorktreeId })?.requestId,
    ).toBe('kept');
  });
});
