import { testClock } from '@porcelain/kernel/test-kit';
import { RunGitActionUseCaseOptions } from '../../ports/run-git-action-use-case-options.ts';
import { Logger } from '../../ports/logger.ts';
import { RefreshWorktreeReviewUseCasePort } from '../../ports/refresh-worktree-review-use-case-port.ts';
import { WorktreeConsistencyProbe } from '../../ports/worktree-consistency-probe.ts';
import { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';
import { LaneOptions } from '../../ports/lane-options.ts';
import {
  ChangeStatusReader,
  WorktreeSideReader,
  ReadChangeFingerprintsOptions,
} from '@porcelain/changes/ports';
import { nativeWrite } from '@porcelain/effects';
import {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import {
  GitActionReceiptStore,
  GitActionRunner,
  ExpireGitActionReceiptsOptions,
  RecordGitActionProgressOptions,
} from '@porcelain/git-actions/ports';
import {
  type GitActionReceipt,
  type GitActionReceiptView,
  type FinishedGitAction,
} from '@porcelain/git-actions/models';
import {
  AcceptGitActionService,
  BeginGitActionService,
  ReadGitActionReceiptService,
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  InterruptGitActionService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import { type ListedWorktree } from '@porcelain/projects/models';
import { Effect, Layer, ManagedRuntime, Clock } from 'effect';
import { WorkflowEngine } from 'effect/workflow';
import { InventoryStore } from '@porcelain/projects/ports';
import { FindProjectService } from '@porcelain/projects/services';
import { GitActionWorkflow } from '../../runtime/git-action-workflow.ts';
import { expect, it } from 'vitest';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { RunGitActionUseCase } from './run-git-action.ts';

class Receipts implements GitActionReceiptStore {
  private readonly rows = new Map<string, GitActionReceipt>();
  private readonly queued = new Set<string>();
  read({ requestId }: { requestId: string }) {
    return Effect.sync(() => {
      const row = this.rows.get(requestId);
      return row && structuredClone(row);
    });
  }
  insert(row: GitActionReceipt) {
    return Effect.sync(() => {
      this.rows.set(row.requestId, structuredClone(row));
      this.queued.add(row.requestId);
    });
  }
  claimExecution(input: { requestId: string }) {
    return Effect.sync(() => this.queued.delete(input.requestId));
  }
  save(row: GitActionReceipt) {
    return Effect.sync(() => {
      this.rows.set(row.requestId, structuredClone(row));
    });
  }
  running() {
    return Effect.sync(() => {
      return [...this.rows.values()].filter((row) => row.state === 'running');
    });
  }
  latestInterrupted(): Effect.Effect<GitActionReceipt | undefined> {
    return Effect.sync(() => {
      return undefined;
    });
  }
  finished(): Effect.Effect<FinishedGitAction[]> {
    return Effect.sync(() => {
      return [];
    });
  }
  remove({ requestIds }: { requestIds: string[] }) {
    return Effect.sync(() => {
      requestIds.forEach((id) => this.rows.delete(id));
    });
  }
}
const worktree: ListedWorktree = {
  id: '0123456789abcdef0123456789abcdef',
  projectId: '24f5e56c-3bf6-4cf2-bf34-2d3b58023d53',
  repositoryId: 'repo',
  path: '/disposable',
  branch: 'refs/heads/main',
  available: true,
  main: true,
  administrativeDirectory: '/disposable/.git',
  commonDirectory: '/disposable/.git',
  metadataIdentity: 'one',
  repositoryIdentity: 'one',
};
const requestId = '8d349263-380b-4f05-946c-09f8220e5c93';
const input = {
  worktreeId: worktree.id,
  requestId,
  input: {
    action: 'fetch' as const,
    remoteName: 'origin',
    sourceRef: 'refs/heads/main',
  },
  expected: {
    headOid: undefined,
    branch: undefined,
    inProgress: undefined,
    mergeHeadOid: undefined,
    upstreamOid: null,
  },
};

async function fixture(onAccepted?: () => void) {
  const clock = await testClock('2026-10-05T05:00:00.000Z');
  const receipts = new Receipts();
  const started = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<void>();
  const notifications: GitActionReceiptView[] = [];
  const failures: unknown[] = [];
  let calls = 0;
  const consistency = { execute: () => Effect.void };
  const laneRuntime = ManagedRuntime.make(
    Lanes.layer.pipe(
      Layer.provide(
        Layer.succeed(LaneOptions, {
          readCapacity: 2,
          deadlineMs: 1000,
          consistency,
        }),
      ),
    ),
  );
  const lanes = await laneRuntime.runPromise(Lanes);
  const keys = Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer)));
  const access = Effect.runSync(
    WorktreeAccess.pipe(
      Effect.provide(WorktreeAccess.layer),
      Effect.provideService(CheckWorktreeUseCasePort, {
        execute: () => Effect.succeed(worktree),
      }),
      Effect.provideService(WorktreeConsistencyProbe, consistency),
      Effect.provideService(Lanes, lanes),
      Effect.provideService(LaneKeys, keys),
    ),
  );
  const events: EventPublisher = {
    inventoryChanged: () => Effect.void,
    projectChanged: () => Effect.void,
    worktreeChanged: () => Effect.void,
    filesChanged: () => Effect.void,
    gitActionChanged: (receipt) =>
      Effect.sync(() => {
        notifications.push(receipt);
        if (receipt.state === 'running') onAccepted?.();
        else finished.resolve();
      }),
  };
  const runner: GitActionRunner = {
    run: (request) =>
      nativeWrite(request.run.worktreeId, (signal) => {
        calls += 1;
        signal.addEventListener('abort', () => aborted.resolve(), {
          once: true,
        });
        started.resolve();
        return cleanup.promise.then(() => ({
          kind: 'finished' as const,
          outcome: { state: 'succeeded' as const, refreshRequired: false },
        }));
      }),
  };
  const unused = () =>
    Effect.die(new Error('Fetch must not inspect the selected file list'));
  const project = {
    id: worktree.projectId,
    name: 'Disposable',
    namedByOwner: false,
    commonDirectory: worktree.commonDirectory,
    repositoryIdentity: worktree.repositoryId,
    available: true,
    position: 1,
  };
  const ports = Layer.mergeAll(
    Layer.succeed(GitActionReceiptStore, receipts),
    Layer.succeed(Clock.Clock, clock),
    Layer.succeed(ExpireGitActionReceiptsOptions, { retentionMs: 10000 }),
    Layer.succeed(RecordGitActionProgressOptions, { progressLines: 10 }),
    Layer.succeed(GitActionRunner, runner),
    Layer.succeed(ChangeStatusReader, {
      readStatus: unused,
      readBranchDetails: unused,
    }),
    Layer.succeed(WorktreeSideReader, {
      readEntries: unused,
      readSubmoduleHeads: unused,
      readStagingStamp: unused,
    }),
    Layer.succeed(ReadChangeFingerprintsOptions, {
      maxPathLength: 100,
      maxDigestBytes: 1000,
    }),
    Layer.succeed(WorktreeAccess, access),
    Layer.succeed(Lanes, lanes),
    Layer.succeed(LaneKeys, keys),
    Layer.succeed(EventPublisher, events),
    Layer.succeed(Logger, {
      failure: (failure) => {
        failures.push(failure);
      },
    }),
    Layer.succeed(RunGitActionUseCaseOptions, { deadlineMs: 1000 }),
    Layer.succeed(RefreshWorktreeReviewUseCasePort, {
      execute: () => Effect.void,
    }),
    Layer.succeed(InventoryStore, {
      read: () => Effect.succeed({ projects: [project] }),
      find: () => Effect.succeed(project),
      save: () => Effect.void,
      markAllUnavailable: () => Effect.void,
      remove: () => Effect.void,
    }),
  );
  const services = Layer.mergeAll(
    AcceptGitActionService.layer,
    ExpireGitActionReceiptsService.layer,
    RunGitActionService.layer,
    RecordGitActionProgressService.layer,
    FinishGitActionService.layer,
    InterruptGitActionService.layer,
    ReadGitActionReceiptService.layer,
    ReadWorktreeStatusService.layer,
    ReadChangeFingerprintsService.layer,
    FindProjectService.layer,
    WorkflowEngine.layerMemory,
  ).pipe(Layer.provideMerge(ports));
  const beginning = BeginGitActionService.layer.pipe(
    Layer.provideMerge(services),
  );
  const workflows = GitActionWorkflow.layer.pipe(Layer.provideMerge(beginning));
  const runtime = ManagedRuntime.make(
    RunGitActionUseCase.layer.pipe(Layer.provideMerge(workflows)),
  );
  const workflow = await runtime.runPromise(GitActionWorkflow);
  const useCase = await runtime.runPromise(RunGitActionUseCase);
  return {
    useCase,
    receipts,
    lanes,
    laneRuntime,
    runtime,
    workflow,
    started,
    aborted,
    finished,
    cleanup,
    notifications,
    failures,
    calls: () => calls,
  };
}

it('accepted work survives caller disconnection and repeated requests do not run it twice', async () => {
  const test = await fixture();
  try {
    const controller = new AbortController();
    const accepted = await Effect.runPromise(test.useCase.execute(input), {
      signal: controller.signal,
    });
    await test.started.promise;
    controller.abort();
    expect(accepted.state).toBe('running');
    test.cleanup.resolve();
    await test.finished.promise;
    const repeated = await Effect.runPromise(test.useCase.execute(input));
    expect(repeated.state).toBe('succeeded');
    expect(test.calls()).toBe(1);
    expect(test.notifications.map((receipt) => receipt.state)).toEqual([
      'running',
      'succeeded',
    ]);
  } finally {
    test.cleanup.resolve();
    await test.runtime.dispose();
    await test.laneRuntime.dispose();
  }
});

it('a disconnect during publication cannot orphan an accepted receipt', async () => {
  const controller = new AbortController();
  const test = await fixture(() => controller.abort());
  try {
    const response = Effect.runPromiseExit(test.useCase.execute(input), {
      signal: controller.signal,
    });
    await test.started.promise;
    test.cleanup.resolve();
    await response;
    await test.finished.promise;
    expect(
      (await Effect.runPromise(test.receipts.read({ requestId })))?.state,
    ).toBe('succeeded');
    expect(test.calls()).toBe(1);
  } finally {
    test.cleanup.resolve();
    await test.runtime.dispose();
    await test.laneRuntime.dispose();
  }
});

it('shutdown records interruption only after the native action has stopped', async () => {
  const test = await fixture();
  try {
    await Effect.runPromise(test.useCase.execute(input));
    await test.started.promise;
    const closing = Effect.runPromise(test.workflow.stop());
    await test.aborted.promise;
    expect(
      (await Effect.runPromise(test.receipts.read({ requestId })))?.state,
    ).toBe('running');
    test.cleanup.resolve();
    await closing;
    expect(
      await Effect.runPromise(test.receipts.read({ requestId })),
    ).toMatchObject({
      state: 'interrupted',
      reason: 'OUTCOME_UNKNOWN',
    });
    expect(test.notifications.map((receipt) => receipt.state)).toEqual([
      'running',
      'interrupted',
    ]);
    expect(test.failures).toHaveLength(1);
  } finally {
    test.cleanup.resolve();
    await test.runtime.dispose();
    await test.laneRuntime.dispose();
  }
});
