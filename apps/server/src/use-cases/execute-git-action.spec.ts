import { GitActionRejectedError } from '@porcelain/git/errors/git-action-rejected-error';
import type { GitActionWriter } from '@porcelain/git/interfaces/git-action-writer';
import { describe, expect, it } from 'vitest';
import { GitActionCoordinator } from '../lifecycle/git-action-coordinator.ts';
import { OperationRunner } from '../lifecycle/operation-runner.ts';
import type {
  GitActionPreparation,
  GitActionReceipt,
} from '../models/git-action.ts';
import type { GitActionStore } from '../repositories/interfaces/git-action-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { AcceptGitAction } from './accept-git-action.ts';
import { ExecuteGitAction } from './execute-git-action.ts';
import { PrepareGitAction } from './prepare-git-action.ts';

describe('Git action execution', () => {
  function fixture() {
    const preparation: GitActionPreparation = {
      id: 'preparation',
      projectId: 'project',
      worktreeId: 'worktree',
      expiresAt: Date.now() + 300_000,
      fingerprint: 'initial',
      intent: { action: 'commit', message: 'message' },
      preview: {
        branch: 'refs/heads/main',
        headOid: 'head',
        staged: true,
        trackedChanges: true,
        untrackedCount: 0,
      },
    };
    const receipt: GitActionReceipt = {
      requestId: 'request',
      preparationId: 'preparation',
      projectId: 'project',
      worktreeId: 'worktree',
      action: 'commit',
      state: 'running',
      refreshRequired: false,
      acceptedAt: Date.now(),
    };
    const state = {
      launched: 0,
      writes: [] as GitActionReceipt[],
      fingerprint: 'initial',
      failPersistence: false,
      expired: false,
      missing: false,
      abortDuringWrite: false,
      unconfirmed: false,
      failBlock: false,
    };
    const inventory: InventoryStore = {
      read: () => ({
        environmentId: 'environment',
        projects: state.missing
          ? []
          : [
              {
                id: 'project',
                name: 'fixture',
                commonDirectory: '/fixture/.git',
                repositoryIdentity: 'repository',
                available: true,
                worktrees: [
                  {
                    id: 'worktree',
                    path: '/fixture',
                    metadataIdentity: 'checkout',
                    available: true,
                    main: true,
                    branch: 'main',
                  },
                ],
              },
            ],
      }),
      save: () => {
        throw new Error('Unexpected inventory write');
      },
    };
    const store: GitActionStore = {
      preparation: () => ({
        ...preparation,
        expiresAt: state.expired ? 0 : preparation.expiresAt,
      }),
      receipt: () => receipt,
      savePreparation: () => {},
      accept: () => ({ receipt, created: true }),
      recover: () => {},
      isBlocked: () =>
        state.writes.some(
          (value) => value.reason === 'PROCESS_GROUP_UNCONFIRMED',
        ),
      blockProject: () => {
        if (state.failBlock) throw new Error('Storage failed while blocking');
      },
      finish: (value) => {
        if (state.failPersistence) throw new Error('Storage failed');
        state.writes.push(value);
      },
    };
    const git: GitActionWriter = {
      inspect: async () => ({
        fingerprint: state.fingerprint,
        preview: preparation.preview,
        stashLog: '',
      }),
      execute: async () => {
        state.launched++;
        if (state.unconfirmed)
          throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
        if (state.abortDuringWrite) throw new Error('Lost acknowledgement');
        return { state: 'succeeded', refreshRequired: true };
      },
    };
    return {
      inventory,
      store,
      git,
      preparation,
      state,
      receipt,
      useCase: new ExecuteGitAction(inventory, store, () => git),
    };
  }

  it.each(['stale', 'expired', 'missing', 'aborted'] as const)(
    'does not launch a %s mutation',
    async (scenario) => {
      const { state, receipt, useCase } = fixture();
      const abort = new AbortController();
      if (scenario === 'stale') state.fingerprint = 'changed';
      if (scenario === 'expired') state.expired = true;
      if (scenario === 'missing') state.missing = true;
      if (scenario === 'aborted') abort.abort();
      await useCase.execute(receipt, abort.signal);
      expect(state.launched).toBe(0);
      expect(state.writes.at(-1)).toMatchObject({
        state: 'rejected',
        refreshRequired: false,
      });
    },
  );

  it('does not launch when the durable prelaunch write fails', async () => {
    const { state, receipt, useCase } = fixture();
    state.failPersistence = true;
    await expect(
      useCase.execute(receipt, new AbortController().signal),
    ).rejects.toThrow('Storage failed');
    expect(state.launched).toBe(0);
  });

  it('records indeterminate effects after lost acknowledgement, without retrying', async () => {
    const { state, receipt, useCase } = fixture();
    state.abortDuringWrite = true;
    await useCase.execute(receipt, new AbortController().signal);
    expect(state.launched).toBe(1);
    expect(state.writes.at(-1)).toMatchObject({
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
    });
  });

  it('blocks already queued work in memory when persisting quarantine fails', async () => {
    const { state, inventory, store, git, preparation, useCase } = fixture();
    state.unconfirmed = true;
    state.failBlock = true;
    store.preparation = (id) => ({ ...preparation, id });
    store.receipt = (id) =>
      state.writes.findLast((value) => value.requestId === id);
    store.accept = (receipt) => {
      state.writes.push(receipt);
      return { receipt, created: true };
    };
    const runner = new OperationRunner(() => {}, 30_000);
    const coordinator = new GitActionCoordinator(
      runner,
      new PrepareGitAction(
        inventory,
        store,
        () => git,
        () => 'preparation',
      ),
      new AcceptGitAction(store),
      useCase,
      store,
    );
    const scope = { projectId: 'project', worktreeId: 'worktree' };
    coordinator.submit(scope, 'commit', 'first', 'first-preparation');
    coordinator.submit(scope, 'commit', 'second', 'second-preparation');
    await runner.runOwned(async () => {}, 30_000);
    expect(state.launched).toBe(1);
    expect(coordinator.receipt('first')).toMatchObject({
      state: 'indeterminate',
      reason: 'PROCESS_GROUP_UNCONFIRMED',
    });
    expect(coordinator.receipt('second')).toMatchObject({
      state: 'indeterminate',
      reason: 'PROCESS_GROUP_UNCONFIRMED',
    });
    expect(() =>
      coordinator.submit(scope, 'commit', 'third', 'third-preparation'),
    ).toThrow();
    await runner.close();
  });

  it('blocks a queued preparation after failed quarantine persistence using the captured scope', async () => {
    const { state, inventory, store, git, useCase } = fixture();
    state.failBlock = true;
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let inspections = 0;
    git.inspect = async () => {
      inspections++;
      started.resolve();
      await release.promise;
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    };
    const runner = new OperationRunner(() => {}, 30_000);
    const coordinator = new GitActionCoordinator(
      runner,
      new PrepareGitAction(
        inventory,
        store,
        () => git,
        () => 'preparation',
      ),
      new AcceptGitAction(store),
      useCase,
      store,
    );
    const scope = { projectId: 'project', worktreeId: 'worktree' };
    const first = coordinator.prepareAction(scope, {
      action: 'commit',
      message: 'first',
    });
    const firstRejection = expect(first).rejects.toMatchObject({
      reason: 'PROCESS_GROUP_UNCONFIRMED',
    });
    await started.promise;
    const second = coordinator.prepareAction(scope, {
      action: 'commit',
      message: 'second',
    });
    const secondRejection = expect(second).rejects.toMatchObject({
      reason: 'PROCESS_GROUP_UNCONFIRMED',
    });
    // Caller mutations must neither redirect the block nor bypass it after queue wait.
    scope.projectId = 'changed-by-caller';
    release.resolve();
    await Promise.all([firstRejection, secondRejection]);
    expect(inspections).toBe(1);
    expect(() =>
      coordinator.prepareAction(
        { projectId: 'project', worktreeId: 'worktree' },
        { action: 'commit', message: 'third' },
      ),
    ).toThrow();
    await runner.close();
  });
});
