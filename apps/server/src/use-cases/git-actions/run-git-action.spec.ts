import { nativeWrite } from '@porcelain/effects';
import {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type {
  GitActionReceiptStore,
  GitActionRunner,
} from '@porcelain/git-actions/ports';
import type {
  GitActionReceipt,
  GitActionReceiptView,
  FinishedGitAction,
} from '@porcelain/git-actions/models';
import {
  AcceptGitActionService,
  ExpireGitActionReceiptsService,
  FinishGitActionService,
  InterruptGitActionService,
  RecordGitActionProgressService,
  RunGitActionService,
} from '@porcelain/git-actions/services';
import type { ListedWorktree } from '@porcelain/projects/models';
import { Effect } from 'effect';
import { expect, it } from 'vitest';
import type { EventPublisher } from '../../ports/event-publisher.ts';
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
  const lanes = new Lanes({ readCapacity: 2, deadlineMs: 1000, consistency });
  const keys = new LaneKeys();
  const access = new WorktreeAccess(
    { execute: () => Effect.succeed(worktree) },
    consistency,
    lanes,
    keys,
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
  const useCase = new RunGitActionUseCase(
    access,
    new ExpireGitActionReceiptsService(receipts, clock, { retentionMs: 10000 }),
    new AcceptGitActionService(receipts, clock),
    new ReadWorktreeStatusService({
      readStatus: unused,
      readBranchDetails: unused,
    }),
    new ReadChangeFingerprintsService(
      {
        readEntries: unused,
        readSubmoduleHeads: unused,
        readStagingStamp: unused,
      },
      { maxPathLength: 100, maxDigestBytes: 1000 },
    ),
    new RunGitActionService(runner),
    new RecordGitActionProgressService(receipts, { progressLines: 10 }),
    new FinishGitActionService(receipts, clock),
    { execute: () => Effect.void },
    new InterruptGitActionService(receipts, clock),
    lanes,
    keys,
    events,
    {
      failure: (failure) => {
        failures.push(failure);
      },
    },
    { deadlineMs: 1000 },
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
