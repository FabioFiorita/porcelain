import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { GitActionRejectedError } from '@porcelain/git/errors/git-action-rejected-error';
import type { GitActionWriter } from '@porcelain/git/interfaces/git-action-writer';
import { describe, expect, it } from 'vitest';
import { openApplication } from './app.ts';
import { ProjectRemovalBlockedError } from './repositories/errors/project-removal-blocked-error.ts';

const snapshot = {
  fingerprint: 'fixture',
  stashLog: '',
  preview: {
    headOid: null,
    branch: 'refs/heads/main',
    staged: true,
    trackedChanges: true,
    untrackedCount: 0,
  },
};

describe('Project removal and Git operation lifecycle', () => {
  it('preserves an action accepted behind queued removal, then invalidates preparations after successful removal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-remove-queue-'));
    const path = join(root, 'repo');
    execFileSync('git', ['init', path]);
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const writer: GitActionWriter = {
      inspect: async () => snapshot,
      execute: async () => {
        started.resolve();
        await release.promise;
        return { state: 'succeeded', refreshRequired: true };
      },
    };
    const app = await openApplication({
      dataDirectory: join(root, 'state'),
      actionGit: () => writer,
    });
    try {
      const { project } = await app.register(path);
      const worktreeId = project.worktrees[0]?.id;
      if (!worktreeId) throw new Error('Missing fixture worktree');
      const scope = { projectId: project.id, worktreeId };
      const first = await app.prepareCommit(scope, { message: 'first' });
      const second = await app.prepareCommit(scope, { message: 'second' });
      const unused = await app.prepareCommit(scope, { message: 'unused' });
      app.executeCommit(scope, {
        requestId: randomUUID(),
        preparationId: first.id,
      });
      await started.promise;
      const removal = app.removeProject(project.id);
      const rejected = expect(removal).rejects.toThrow(
        ProjectRemovalBlockedError,
      );
      const secondId = randomUUID();
      app.executeCommit(scope, {
        requestId: secondId,
        preparationId: second.id,
      });
      release.resolve();
      await rejected;
      await expect
        .poll(() => app.gitActionReceipt(secondId).state)
        .toBe('succeeded');
      expect(app.inventory().projects).toEqual([project]);
      expect(await app.removeProject(project.id)).toEqual({ deleted: true });
      expect(() =>
        app.executeCommit(scope, {
          requestId: randomUUID(),
          preparationId: unused.id,
        }),
      ).toThrow(expect.objectContaining({ reason: 'STALE_PREPARATION' }));
      expect(app.inventory().projects).toEqual([]);
    } finally {
      release.resolve();
      await app.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps the in-memory recovery block effective when its database write fails', async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'porcelain-remove-memory-block-'),
    );
    const path = join(root, 'repo');
    execFileSync('git', ['init', path]);
    const writer: GitActionWriter = {
      inspect: async () => {
        throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
      },
      execute: async () => {
        throw new Error('Must not execute');
      },
    };
    const dataDirectory = join(root, 'state');
    const app = await openApplication({
      dataDirectory,
      actionGit: () => writer,
    });
    const db = new DatabaseSync(join(dataDirectory, 'inventory.sqlite'));
    try {
      const { project } = await app.register(path);
      const worktreeId = project.worktrees[0]?.id;
      if (!worktreeId) throw new Error('Missing fixture worktree');
      db.exec(
        "CREATE TRIGGER reject_block BEFORE INSERT ON git_action_blocks BEGIN SELECT RAISE(ABORT, 'fixture write failure'); END",
      );
      await expect(
        app.prepareCommit(
          { projectId: project.id, worktreeId },
          { message: 'prepare' },
        ),
      ).rejects.toMatchObject({ reason: 'PROCESS_GROUP_UNCONFIRMED' });
      expect(db.prepare('SELECT * FROM git_action_blocks').all()).toEqual([]);
      await expect(app.removeProject(project.id)).rejects.toThrow(
        ProjectRemovalBlockedError,
      );
      expect(app.inventory().projects).toEqual([project]);
    } finally {
      db.close();
      await app.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
