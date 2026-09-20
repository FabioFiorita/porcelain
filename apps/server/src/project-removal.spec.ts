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
import { GitActionNotFoundError } from './use-cases/errors/git-action-not-found-error.ts';

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
  it('waits for a running action, then removes the project and refuses what was queued behind it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-remove-queue-'));
    const path = join(root, 'repo');
    execFileSync('git', ['init', path]);
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let executions = 0;
    const writer: GitActionWriter = {
      inspect: async () => snapshot,
      execute: async () => {
        executions += 1;
        started.resolve();
        await release.promise;
        return { state: 'succeeded', refreshRequired: true };
      },
    };
    const app = await openApplication({
      dataDirectory: join(root, 'state'),
      projectHome: join(root, 'state'),
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
      // Removal is a writer on this project's lane, so it is admitted after
      // the action that holds it. That wait is the only one there is.
      const removal = app.removeProject(project.id);
      // Submitting persists a running receipt before it asks for the lane, so
      // this one is in the database when removal deletes everything.
      const secondId = randomUUID();
      app.executeCommit(scope, {
        requestId: secondId,
        preparationId: second.id,
      });
      release.resolve();
      expect(await removal).toEqual({ deleted: true });
      expect((await app.inventory()).inventory.projects).toEqual([]);
      // What was queued finds its preparation gone. Its receipt went with the
      // project, so asking after it is a not-found rather than a terminal
      // state — and the action itself never ran: Git was launched once, for
      // the commit that held the lane.
      expect(() => app.gitActionReceipt(secondId)).toThrow(
        GitActionNotFoundError,
      );
      expect(executions).toBe(1);
      // Nothing came back with it: the repository is registrable again and
      // the receipt is not resurrected by the executor unwinding behind us.
      const { project: again } = await app.register(path);
      expect(again.id).not.toBe(project.id);
      expect(() => app.gitActionReceipt(secondId)).toThrow(
        GitActionNotFoundError,
      );
      expect(() =>
        app.executeCommit(scope, {
          requestId: randomUUID(),
          preparationId: unused.id,
        }),
      ).toThrow(expect.objectContaining({ reason: 'STALE_PREPARATION' }));
    } finally {
      release.resolve();
      await app.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps refusing actions after a failed block write, and still allows removal', async () => {
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
      projectHome: dataDirectory,
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
      // The latch is in memory, so the next action is refused before it can
      // reach a lane, even though nothing could be written down about it.
      expect(() =>
        app.prepareCommit(
          { projectId: project.id, worktreeId },
          { message: 'again' },
        ),
      ).toThrow(
        expect.objectContaining({ reason: 'PROCESS_GROUP_UNCONFIRMED' }),
      );
      // Removing it is still allowed. A project no action can run against is
      // exactly the one an owner wants rid of, and removal touches no disk.
      expect(await app.removeProject(project.id)).toEqual({ deleted: true });
      expect((await app.inventory()).inventory.projects).toEqual([]);
    } finally {
      db.close();
      await app.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
