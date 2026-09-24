import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RegisteredProject } from '@porcelain/projects/models';
import type { CommentThread } from '@porcelain/reviews/models';
import { commentStoreContract } from '@porcelain/reviews/store-contracts';
import { openStorageSession, type StorageSession } from '../../index.ts';
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

function present(session: StorageSession, worktreeIds: readonly string[]) {
  createWorktreePresenceStore(session).save({
    rows: worktreeIds.map((worktreeId) => ({
      worktreeId,
      projectId: project.id,
      missingSince: undefined,
    })),
  });
}

commentStoreContract('SqliteCommentStore', (worktreeIds) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = openStorageSession(dataDirectory);
  createInventoryStore(session).save(project);
  present(session, worktreeIds);
  return {
    store: createCommentStore(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});

describe('SqliteCommentStore revisions across collection', () => {
  const kept = 'a'.repeat(64);
  const collected = 'b'.repeat(64);
  let dataDirectory: string;
  let session: StorageSession;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
    session = openStorageSession(dataDirectory);
    createInventoryStore(session).save(project);
    present(session, [kept, collected]);
  });

  afterEach(() => {
    session.close();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  function open(id: string, worktreeId: string): CommentThread {
    return createCommentStore(session).insert({
      content: {
        id,
        worktreeId,
        anchor: { kind: 'file', filePath: 'README.md' },
        messages: [{ id: `${id}-opening`, body: 'Why?', author: 'reviewer' }],
      },
      sizeBytes: 4,
      writtenByAgent: false,
    });
  }

  function collect(worktreeId: string) {
    createWorktreePresenceStore(session).remove({ worktreeIds: [worktreeId] });
  }

  it('hands out a revision above every earlier one after the worktree holding the latest revision is collected', () => {
    open('kept-thread', kept);
    const latest = createCommentStore(session).resolve({
      thread: open('collected-thread', collected),
      resolved: true,
    });
    collect(collected);
    expect(open('after-collection', kept).revision).toBeGreaterThan(
      latest.revision,
    );
  });

  it('writes a returning worktree above every revision it had, so a seen mark taken before the collection cannot cover it', () => {
    open('other-thread', kept);
    open('first', collected);
    open('second', collected);
    const seenBefore = createCommentStore(session).lastRevision({
      worktreeId: collected,
    });
    collect(collected);
    present(session, [collected]);
    expect(open('after-return', collected).revision).toBeGreaterThan(
      seenBefore,
    );
  });
});
