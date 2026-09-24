import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitActionReceipt } from '@porcelain/git-actions/models';
import type { RegisteredProject } from '@porcelain/projects/models';
import type { CommentThread } from '@porcelain/reviews/models';
import { openStorageSession, type StorageSession } from '../../index.ts';
import { createGitActionStore } from '../git-actions/index.ts';
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
  createProjectRemovalStore,
  createWorktreePresenceStore,
} from './index.ts';

const at = '2026-09-01T00:00:00.000Z';

function project(id: string): RegisteredProject {
  return {
    id,
    name: id,
    namedByOwner: false,
    commonDirectory: `/repositories/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available: true,
  };
}

function thread(worktreeId: string): CommentThread {
  return {
    id: `thread-${worktreeId}`,
    worktreeId,
    anchor: { kind: 'file', filePath: 'README.md' },
    resolved: false,
    messages: [
      { id: `message-${worktreeId}`, body: 'Why?', author: 'reviewer' },
    ],
    revision: 1,
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
    acceptedAt: 1,
    finishedAt: 2,
  };
}

function seed(session: StorageSession, projectId: string, worktreeId: string) {
  createInventoryStore(session).save(project(projectId));
  createWorktreePresenceStore(session).observe(projectId, [worktreeId], at);
  createFilePreferenceStore(session).save(projectId, {
    path: 'README.md',
    pinned: true,
    hidden: false,
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
  createReviewedFileStore(session).save(worktreeId, {
    path: 'README.md',
    fingerprint: 'fingerprint',
    reviewedAt: at,
    stale: false,
  });
  createReviewedLayerStore(session).save(worktreeId, {
    layerId: 'layer',
    fingerprint: 'fingerprint',
    reviewedAt: at,
    stale: false,
  });
  createCommentStore(session).insert(thread(worktreeId), {
    sizeBytes: 4,
    lastAgentRevision: undefined,
  });
  createCommentSeenStore(session).save(worktreeId, 1);
  createGitActionStore(session).insert(receipt(projectId, worktreeId));
}

function stored(
  session: StorageSession,
  projectId: string,
  worktreeId: string,
) {
  return {
    project: createInventoryStore(session)
      .read()
      .projects.some((entry) => entry.id === projectId),
    preferences: createFilePreferenceStore(session).count(projectId),
    review: createReviewStore(session).read(worktreeId) !== undefined,
    reviewedFiles: createReviewedFileStore(session).count(worktreeId),
    reviewedLayers: createReviewedLayerStore(session).list(worktreeId).length,
    threads: createCommentStore(session).list(worktreeId).length,
    message:
      createCommentStore(session).findMessage(`message-${worktreeId}`) !==
      undefined,
    seenThrough: createCommentSeenStore(session).seenThrough(worktreeId),
    receipt:
      createGitActionStore(session).read(`request-${worktreeId}`) !== undefined,
  };
}

const everything = {
  project: true,
  preferences: 1,
  review: true,
  reviewedFiles: 1,
  reviewedLayers: 1,
  threads: 1,
  message: true,
  seenThrough: 1,
  receipt: true,
};

const nothing = {
  project: false,
  preferences: 0,
  review: false,
  reviewedFiles: 0,
  reviewedLayers: 0,
  threads: 0,
  message: false,
  seenThrough: 0,
  receipt: false,
};

describe('SqliteProjectRemovalStore', () => {
  let dataDirectory: string;
  let session: StorageSession;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
    session = openStorageSession(dataDirectory, {
      worktreeId: (projectId, metadataIdentity) =>
        `${projectId}:${metadataIdentity}`,
    });
  });

  afterEach(() => {
    session.close();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('removes the project with everything stored for it and its worktrees', () => {
    seed(session, 'removed', 'removed-worktree');
    seed(session, 'kept', 'kept-worktree');

    expect(createProjectRemovalStore(session).remove('removed')).toEqual({
      deleted: true,
    });

    expect(stored(session, 'removed', 'removed-worktree')).toEqual(nothing);
    expect(stored(session, 'kept', 'kept-worktree')).toEqual(everything);
  });

  it('reports nothing deleted for a project that is not registered', () => {
    seed(session, 'kept', 'kept-worktree');

    expect(createProjectRemovalStore(session).remove('unknown')).toEqual({
      deleted: false,
    });
    expect(stored(session, 'kept', 'kept-worktree')).toEqual(everything);
  });
});
