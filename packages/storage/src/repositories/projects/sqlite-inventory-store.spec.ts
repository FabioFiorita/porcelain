import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitActionReceipt } from '@porcelain/git-actions/models';
import type { RegisteredProject } from '@porcelain/projects/models';
import { inventoryStoreContract } from '@porcelain/projects/store-contracts';
import { openStorageSession, type StorageSession } from '../../index.ts';
import { createGitActionReceiptStore } from '../git-actions/index.ts';
import {
  createCommentSeenStore,
  createCommentStore,
  createReviewedFileStore,
  createReviewedLayerStore,
  createReviewStore,
} from '../reviews/index.ts';
import {
  createFilePreferenceStore,
  createInventoryStore,
  createWorktreePresenceStore,
} from './index.ts';

const at = '2026-09-01T00:00:00.000Z';

inventoryStoreContract('SqliteInventoryStore', () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = openStorageSession(dataDirectory);
  return {
    store: createInventoryStore(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});

function project(id: string): RegisteredProject {
  return {
    id,
    name: id,
    namedByOwner: false,
    commonDirectory: `/repositories/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available: true,
    position: 1,
  };
}

function receipt(projectId: string, worktreeId: string): GitActionReceipt {
  return {
    requestId: `request-${worktreeId}`,
    projectId,
    worktreeId,
    action: 'fetch',
    intent: { action: 'fetch', remoteName: 'origin', sourceRef: 'main' },
    expected: {},
    state: 'succeeded',
    progress: [],
    refreshRequired: false,
    acceptedAt: '2026-09-23T09:00:00.000Z',
    finishedAt: '2026-09-23T09:00:05.000Z',
  };
}

function seed(session: StorageSession, projectId: string, worktreeId: string) {
  createInventoryStore(session).save(project(projectId));
  createWorktreePresenceStore(session).save({
    rows: [{ worktreeId, projectId, missingSince: undefined }],
  });
  createFilePreferenceStore(session).save({
    projectId,
    preference: { path: 'README.md', pinned: true, hidden: false },
  });
  createReviewStore(session).save({
    worktreeId,
    revision: 1,
    publishedAt: at,
    active: true,
    summaryHtml: '<p>Summary</p>',
    summaryToken: `token-${worktreeId}`,
    summarySecret: 'secret',
    layers: [],
  });
  createReviewedFileStore(session).save({
    worktreeId,
    marks: [
      {
        path: 'README.md',
        fingerprint: 'fingerprint',
        reviewedAt: at,
        stale: false,
      },
    ],
  });
  createReviewedLayerStore(session).save({
    worktreeId,
    marks: [
      {
        layerId: 'layer',
        fingerprint: 'fingerprint',
        reviewedAt: at,
      },
    ],
  });
  createCommentStore(session).insert({
    content: {
      id: `thread-${worktreeId}`,
      worktreeId,
      anchor: { kind: 'file', filePath: 'README.md' },
      messages: [
        { id: `message-${worktreeId}`, body: 'Why?', author: 'reviewer' },
      ],
    },
    sizeBytes: 4,
    writtenByAgent: false,
  });
  createCommentSeenStore(session).save({ worktreeId, seenThrough: 1 });
  createGitActionReceiptStore(session).insert(receipt(projectId, worktreeId));
}

function stored(
  session: StorageSession,
  projectId: string,
  worktreeId: string,
) {
  return {
    project: createInventoryStore(session).find({ projectId }) !== undefined,
    presence: createWorktreePresenceStore(session).read({ projectId }).length,
    preferences: createFilePreferenceStore(session).count({ projectId }),
    review: createReviewStore(session).read({ worktreeId }) !== undefined,
    reviewedFiles: createReviewedFileStore(session).list({ worktreeId }).length,
    reviewedLayers: createReviewedLayerStore(session).list({ worktreeId })
      .length,
    threads: createCommentStore(session).list({ worktreeId }).length,
    message:
      createCommentStore(session).findMessage({
        messageId: `message-${worktreeId}`,
      }) !== undefined,
    seenThrough: createCommentSeenStore(session).seenThrough({ worktreeId }),
    receipt:
      createGitActionReceiptStore(session).read({
        requestId: `request-${worktreeId}`,
      }) !== undefined,
  };
}

describe('SqliteInventoryStore removal', () => {
  let dataDirectory: string;
  let session: StorageSession;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
    session = openStorageSession(dataDirectory);
  });

  afterEach(() => {
    session.close();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('removes everything stored for the project and its worktrees and keeps every other project', () => {
    seed(session, 'removed', 'removed-worktree');
    seed(session, 'kept', 'kept-worktree');

    createInventoryStore(session).remove({ projectId: 'removed' });

    expect(stored(session, 'removed', 'removed-worktree')).toEqual({
      project: false,
      presence: 0,
      preferences: 0,
      review: false,
      reviewedFiles: 0,
      reviewedLayers: 0,
      threads: 0,
      message: false,
      seenThrough: 0,
      receipt: false,
    });
    expect(stored(session, 'kept', 'kept-worktree')).toEqual({
      project: true,
      presence: 1,
      preferences: 1,
      review: true,
      reviewedFiles: 1,
      reviewedLayers: 1,
      threads: 1,
      message: true,
      seenThrough: 1,
      receipt: true,
    });
  });
});
