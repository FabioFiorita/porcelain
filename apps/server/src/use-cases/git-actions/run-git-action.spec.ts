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
import { Clock } from '@porcelain/kernel/ports';
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
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  InterruptGitActionService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import { type ListedWorktree } from '@porcelain/projects/models';
import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { RunGitActionUseCase } from './run-git-action.ts';

class Receipts implements GitActionReceiptStore {
  private readonly rows = new Map<string, GitActionReceipt>();
  read({ requestId }: { requestId: string }) {
    const row = this.rows.get(requestId);
    return row && structuredClone(row);
  }
  insert(row: GitActionReceipt) {
    this.rows.set(row.requestId, structuredClone(row));
  }
  save(row: GitActionReceipt) {
    this.rows.set(row.requestId, structuredClone(row));
  }
  running() {
    return [...this.rows.values()].filter((row) => row.state === 'running');
  }
  latestInterrupted(): GitActionReceipt | undefined {
    return undefined;
  }
  finished(): FinishedGitAction[] {
    return [];
  }
  remove({ requestIds }: { requestIds: string[] }) {
    requestIds.forEach((id) => this.rows.delete(id));
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
const clock = { now: () => '2026-10-05T05:00:00.000Z' };

function fixture(onAccepted?: () => void) {
  const receipts = new Receipts();
  const started = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<void>();
  const notifications: GitActionReceiptView[] = [];
  const failures: unknown[] = [];
  let calls = 0;
  const consistency = { execute: () => Effect.void };
  const lanes = Effect.runSync(
    Lanes.pipe(
      Effect.provide(Lanes.layer),
      Effect.provideService(LaneOptions, {
        readCapacity: 2,
        deadlineMs: 1000,
        consistency,
      }),
    ),
  );
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
    inventoryChanged: () => undefined,
    projectChanged: () => undefined,
    worktreeChanged: () => undefined,
    filesChanged: () => undefined,
    gitActionChanged: (receipt) => {
      notifications.push(receipt);
      if (receipt.state === 'running') onAccepted?.();
      else finished.resolve();
    },
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
  const useCase = Effect.runSync(
    RunGitActionUseCase.pipe(
      Effect.provide(RunGitActionUseCase.layer),
      Effect.provideService(WorktreeAccess, access),
      Effect.provideService(
        ExpireGitActionReceiptsService,
        Effect.runSync(
          ExpireGitActionReceiptsService.pipe(
            Effect.provide(ExpireGitActionReceiptsService.layer),
            Effect.provideService(GitActionReceiptStore, receipts),
            Effect.provideService(Clock, clock),
            Effect.provideService(ExpireGitActionReceiptsOptions, {
              retentionMs: 10000,
            }),
          ),
        ),
      ),
      Effect.provideService(
        AcceptGitActionService,
        Effect.runSync(
          AcceptGitActionService.pipe(
            Effect.provide(AcceptGitActionService.layer),
            Effect.provideService(GitActionReceiptStore, receipts),
            Effect.provideService(Clock, clock),
          ),
        ),
      ),
      Effect.provideService(
        ReadWorktreeStatusService,
        Effect.runSync(
          ReadWorktreeStatusService.pipe(
            Effect.provide(ReadWorktreeStatusService.layer),
            Effect.provideService(ChangeStatusReader, {
              readStatus: unused,
              readBranchDetails: unused,
            }),
          ),
        ),
      ),
      Effect.provideService(
        ReadChangeFingerprintsService,
        Effect.runSync(
          ReadChangeFingerprintsService.pipe(
            Effect.provide(ReadChangeFingerprintsService.layer),
            Effect.provideService(WorktreeSideReader, {
              readEntries: unused,
              readSubmoduleHeads: unused,
              readStagingStamp: unused,
            }),
            Effect.provideService(ReadChangeFingerprintsOptions, {
              maxPathLength: 100,
              maxDigestBytes: 1000,
            }),
          ),
        ),
      ),
      Effect.provideService(
        RunGitActionService,
        Effect.runSync(
          RunGitActionService.pipe(
            Effect.provide(RunGitActionService.layer),
            Effect.provideService(GitActionRunner, runner),
          ),
        ),
      ),
      Effect.provideService(
        RecordGitActionProgressService,
        Effect.runSync(
          RecordGitActionProgressService.pipe(
            Effect.provide(RecordGitActionProgressService.layer),
            Effect.provideService(GitActionReceiptStore, receipts),
            Effect.provideService(RecordGitActionProgressOptions, {
              progressLines: 10,
            }),
          ),
        ),
      ),
      Effect.provideService(
        FinishGitActionService,
        Effect.runSync(
          FinishGitActionService.pipe(
            Effect.provide(FinishGitActionService.layer),
            Effect.provideService(GitActionReceiptStore, receipts),
            Effect.provideService(Clock, clock),
          ),
        ),
      ),
      Effect.provideService(RefreshWorktreeReviewUseCasePort, {
        execute: () => Effect.void,
      }),
      Effect.provideService(
        InterruptGitActionService,
        Effect.runSync(
          InterruptGitActionService.pipe(
            Effect.provide(InterruptGitActionService.layer),
            Effect.provideService(GitActionReceiptStore, receipts),
            Effect.provideService(Clock, clock),
          ),
        ),
      ),
      Effect.provideService(Lanes, lanes),
      Effect.provideService(LaneKeys, keys),
      Effect.provideService(EventPublisher, events),
      Effect.provideService(Logger, {
        failure: (failure) => {
          failures.push(failure);
        },
      }),
      Effect.provideService(RunGitActionUseCaseOptions, { deadlineMs: 1000 }),
    ),
  );
  return {
    useCase,
    receipts,
    lanes,
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
  const test = fixture();
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
    await test.lanes.close();
  }
});

it('a disconnect during publication cannot orphan an accepted receipt', async () => {
  const controller = new AbortController();
  const test = fixture(() => controller.abort());
  try {
    const response = Effect.runPromiseExit(test.useCase.execute(input), {
      signal: controller.signal,
    });
    await test.started.promise;
    test.cleanup.resolve();
    await response;
    await test.finished.promise;
    expect(test.receipts.read({ requestId })?.state).toBe('succeeded');
    expect(test.calls()).toBe(1);
  } finally {
    test.cleanup.resolve();
    await test.lanes.close();
  }
});

it('shutdown records interruption only after the native action has stopped', async () => {
  const test = fixture();
  try {
    await Effect.runPromise(test.useCase.execute(input));
    await test.started.promise;
    const closing = test.lanes.close();
    await test.aborted.promise;
    expect(test.receipts.read({ requestId })?.state).toBe('running');
    test.cleanup.resolve();
    await closing;
    expect(test.receipts.read({ requestId })).toMatchObject({
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
    await test.lanes.close();
  }
});
