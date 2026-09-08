import { expect, it } from 'vitest';
import type { GitActionPreparation } from '../../models/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import type { GitProcessResult } from '../dtos/git-process-result.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { fetchBranch } from './fetch-branch.ts';
import { readActionCommand } from './read-action-command.ts';
import { removeAppliedStash } from './remove-applied-stash.ts';

const oid = 'a'.repeat(40);
const snapshot: GitActionSnapshot = {
  fingerprint: 'fingerprint',
  stashLog: `${oid}\0stash@{0}\0fixture\n`,
  remote: {
    name: 'fixture',
    url: '/fixture',
    trackingRef: 'refs/remotes/fixture/main',
  },
  preview: {
    branch: 'refs/heads/main',
    headOid: oid,
    staged: false,
    trackedChanges: false,
    untrackedCount: 0,
    trackingOid: 'b'.repeat(40),
  },
};
const preparation: GitActionPreparation = {
  id: 'preparation',
  projectId: 'project',
  worktreeId: 'worktree',
  expiresAt: Date.now() + 300_000,
  fingerprint: 'fingerprint',
  preview: snapshot.preview,
  intent: {
    action: 'fetch',
    remoteName: 'fixture',
    sourceRef: 'refs/heads/main',
  },
};
const successful = (stdout = ''): GitProcessResult => ({
  stdout: Buffer.from(stdout),
  exitCode: 0,
  started: true,
  interrupted: false,
  descendantsStopped: true,
});
const unconfirmed = (): GitProcessResult => ({
  ...successful(),
  descendantsStopped: false,
});

it('preserves unconfirmed ownership from inspection even when caller cancellation races', async () => {
  const abort = new AbortController();
  const process: GitProcessRunner = {
    execute: async () => {
      abort.abort();
      return unconfirmed();
    },
  };
  await expect(
    readActionCommand(process, ['status'], abort.signal),
  ).rejects.toMatchObject({ reason: 'PROCESS_GROUP_UNCONFIRMED' });
});

it('preserves unconfirmed ownership after the stash was applied and drop cannot finish', async () => {
  const process: GitProcessRunner = {
    execute: async (args) =>
      args[1] === 'drop' ? unconfirmed() : successful(snapshot.stashLog),
  };
  expect(
    await removeAppliedStash(
      process,
      oid,
      snapshot,
      new AbortController().signal,
    ),
  ).toMatchObject({
    state: 'indeterminate',
    reason: 'PROCESS_GROUP_UNCONFIRMED',
    refreshRequired: true,
  });
});

it.each(['ancestry', 'cleanup'] as const)(
  'quarantines unconfirmed fetch %s instead of reporting success or ordinary rejection',
  async (phase) => {
    const laterCommands: string[] = [];
    let lostOwnership = false;
    const process: GitProcessRunner = {
      execute: async (args) => {
        if (lostOwnership) laterCommands.push(args[0] ?? '');
        if (
          (phase === 'ancestry' && args[0] === 'merge-base') ||
          (phase === 'cleanup' && args[0] === 'update-ref' && args[1] === '-d')
        ) {
          lostOwnership = true;
          return { ...unconfirmed(), exitCode: phase === 'ancestry' ? 1 : 0 };
        }
        return successful(args[0] === 'rev-parse' ? `${oid}\n` : '');
      },
    };
    expect(
      await fetchBranch(
        process,
        preparation,
        snapshot,
        new AbortController().signal,
      ),
    ).toMatchObject({
      state: 'indeterminate',
      reason: 'PROCESS_GROUP_UNCONFIRMED',
      refreshRequired: true,
    });
    expect(laterCommands).toEqual([]);
  },
);
