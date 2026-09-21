import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GitActionWriter } from '@porcelain/git/interfaces/git-action-writer';
import { expect, it } from 'vitest';
import { openApplication } from './app.ts';
import { GitActionNotFoundError } from './use-cases/errors/git-action-not-found-error.ts';

it('waits for a running direct action, removes its queued receipt, and does not launch it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-remove-queue-'));
  const path = join(root, 'repo');
  execFileSync('git', ['init', path]);
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let executions = 0;
  const writer: GitActionWriter = {
    executeDirect: async () => {
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
    const request = (requestId: string, branch: string) => ({
      requestId,
      input: { action: 'switch-branch' as const, branch },
      expected: {
        headOid: null,
        branch: null,
        inProgress: null,
        mergeHeadOid: null,
      },
    });
    app.runGitAction(scope, request(randomUUID(), 'first'));
    await started.promise;
    const removal = app.removeProject(project.id);
    const queuedId = randomUUID();
    app.runGitAction(scope, request(queuedId, 'second'));
    release.resolve();
    expect(await removal).toEqual({ deleted: true });
    expect((await app.inventory()).inventory.projects).toEqual([]);
    expect(() => app.gitActionReceipt(queuedId)).toThrow(
      GitActionNotFoundError,
    );
    expect(executions).toBe(1);
  } finally {
    release.resolve();
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
