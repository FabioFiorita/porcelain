import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { openApplication } from './app.ts';
import { GitActionRejectedError } from './git/errors/git-action-rejected-error.ts';
import type { GitActionWriter } from './git/interfaces/git-action-writer.ts';

const execute = promisify(execFile);
it('persists unconfirmed cleanup before a second accepted action can launch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-action-quarantine-'));
  const checkout = join(root, 'checkout');
  await mkdir(checkout);
  await execute('git', ['init', checkout]);
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let launches = 0;
  const git: GitActionWriter = {
    inspect: async () => ({
      fingerprint: 'fingerprint',
      stashLog: '',
      preview: {
        headOid: null,
        branch: 'refs/heads/main',
        staged: true,
        trackedChanges: true,
        untrackedCount: 0,
      },
    }),
    execute: async () => {
      launches++;
      started.resolve();
      await release.promise;
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    },
  };
  const options = { dataDirectory: join(root, 'data'), actionGit: () => git };
  const app = await openApplication(options);
  try {
    const { project } = await app.register(checkout);
    const worktreeId = project.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Missing worktree');
    const scope = { projectId: project.id, worktreeId };
    const first = await app.prepareCommit(scope, { message: 'first' });
    const second = await app.prepareCommit(scope, { message: 'second' });
    const firstRequest = randomUUID();
    const secondRequest = randomUUID();
    app.executeCommit(scope, {
      preparationId: first.id,
      requestId: firstRequest,
    });
    await started.promise;
    expect(
      app.executeCommit(scope, {
        preparationId: second.id,
        requestId: secondRequest,
      }),
    ).toMatchObject({ state: 'running' });
    release.resolve();
    await expect
      .poll(() => app.gitActionReceipt(secondRequest).state)
      .toBe('indeterminate');
    expect(launches).toBe(1);
    expect(app.gitActionReceipt(firstRequest)).toMatchObject({
      state: 'indeterminate',
      reason: 'PROCESS_GROUP_UNCONFIRMED',
    });
    expect(app.gitActionReceipt(secondRequest)).toMatchObject({
      reason: 'PROCESS_GROUP_UNCONFIRMED',
    });
    await app.close();
    const reopened = await openApplication(options);
    try {
      await expect(
        reopened.prepareCommit(scope, { message: 'after restart' }),
      ).rejects.toMatchObject({ reason: 'PROCESS_GROUP_UNCONFIRMED' });
      expect(launches).toBe(1);
    } finally {
      await reopened.close();
    }
  } finally {
    release.resolve();
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('persists an inspection quarantine even though preparation has no request receipt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-prepare-quarantine-'));
  const checkout = join(root, 'checkout');
  await mkdir(checkout);
  await execute('git', ['init', checkout]);
  let inspections = 0;
  const git: GitActionWriter = {
    inspect: async () => {
      inspections++;
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    },
    execute: async () => {
      throw new Error('Must not execute');
    },
  };
  const options = { dataDirectory: join(root, 'data'), actionGit: () => git };
  const app = await openApplication(options);
  try {
    const { project } = await app.register(checkout);
    const worktreeId = project.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Missing worktree');
    const scope = { projectId: project.id, worktreeId };
    await expect(
      app.prepareCommit(scope, { message: 'prepare' }),
    ).rejects.toMatchObject({ reason: 'PROCESS_GROUP_UNCONFIRMED' });
    await app.close();
    const reopened = await openApplication(options);
    try {
      await expect(
        reopened.prepareCommit(scope, { message: 'again' }),
      ).rejects.toMatchObject({ reason: 'PROCESS_GROUP_UNCONFIRMED' });
      expect(inspections).toBe(1);
    } finally {
      await reopened.close();
    }
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
