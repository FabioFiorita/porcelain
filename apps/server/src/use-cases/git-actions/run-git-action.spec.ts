import { testClock } from '@porcelain/kernel/test-kit';
import {
  GitActionReceiptStore,
  ExpireGitActionReceiptsOptions,
} from '@porcelain/git-actions/ports';
import {
  type GitActionReceipt,
  type GitActionReceiptView,
} from '@porcelain/git-actions/models';
import {
  AcceptGitActionService,
  ExpireGitActionReceiptsService,
} from '@porcelain/git-actions/services';
import { type ListedWorktree } from '@porcelain/projects/models';
import { Clock, Effect, Layer, ManagedRuntime } from 'effect';
import { expect, it } from 'vitest';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { GitActionQueueRunner } from '../../ports/git-action-queue-runner.ts';
import { WorktreeConsistencyProbe } from '../../ports/worktree-consistency-probe.ts';
import { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';
import { LaneOptions } from '../../ports/lane-options.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { RunGitActionUseCase } from './run-git-action.ts';

function receiptStore(): GitActionReceiptStore {
  const rows = new Map<string, GitActionReceipt>();
  const queued = new Set<string>();
  return GitActionReceiptStore.of({
    read: ({ requestId }) => Effect.sync(() => rows.get(requestId)),
    insert: (row) =>
      Effect.sync(() => {
        rows.set(row.requestId, structuredClone(row));
        queued.add(row.requestId);
      }),
    claimExecution: ({ requestId }) =>
      Effect.sync(() => queued.delete(requestId)),
    save: (row) =>
      Effect.sync(() => {
        rows.set(row.requestId, structuredClone(row));
      }),
    running: () =>
      Effect.sync(() =>
        [...rows.values()].filter((row) => row.state === 'running'),
      ),
    latestInterrupted: () => Effect.succeed(undefined),
    finished: () => Effect.succeed([]),
    remove: ({ requestIds }) =>
      Effect.sync(() => {
        for (const requestId of requestIds) {
          rows.delete(requestId);
          queued.delete(requestId);
        }
      }),
  });
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
const input = {
  worktreeId: worktree.id,
  requestId: '8d349263-380b-4f05-946c-09f8220e5c93',
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
  const receipts = receiptStore();
  const queued: string[] = [];
  const published: GitActionReceiptView[] = [];
  const enqueued = Promise.withResolvers<void>();
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
  const ports = Layer.mergeAll(
    Layer.succeed(GitActionReceiptStore, receipts),
    Layer.succeed(Clock.Clock, await testClock('2026-10-05T05:00:00.000Z')),
    Layer.succeed(ExpireGitActionReceiptsOptions, { retentionMs: 10000 }),
    Layer.succeed(WorktreeAccess, access),
    Layer.succeed(GitActionQueueRunner, {
      execute: ({ requestId }) =>
        Effect.sync(() => {
          queued.push(requestId);
          enqueued.resolve();
        }),
    }),
    Layer.succeed(EventPublisher, {
      inventoryChanged: () => Effect.void,
      projectChanged: () => Effect.void,
      worktreeChanged: () => Effect.void,
      filesChanged: () => Effect.void,
      gitActionChanged: (receipt) =>
        Effect.sync(() => {
          published.push(receipt);
          onAccepted?.();
        }),
    }),
  );
  const services = Layer.mergeAll(
    AcceptGitActionService.layer,
    ExpireGitActionReceiptsService.layer,
  ).pipe(Layer.provideMerge(ports));
  const runtime = ManagedRuntime.make(
    RunGitActionUseCase.layer.pipe(Layer.provideMerge(services)),
  );
  return {
    useCase: await runtime.runPromise(RunGitActionUseCase),
    receipts,
    queued,
    published,
    enqueued,
    runtime,
    laneRuntime,
  };
}

it('durably accepts and enqueues an exact request only once', async () => {
  const test = await fixture();
  try {
    expect((await Effect.runPromise(test.useCase.execute(input))).state).toBe(
      'running',
    );
    await Effect.runPromise(test.useCase.execute(input));
    expect(test.queued).toEqual([input.requestId]);
    expect(test.published.map((receipt) => receipt.state)).toEqual(['running']);
    expect(
      await Effect.runPromise(
        test.receipts.read({ requestId: input.requestId }),
      ),
    ).toMatchObject({ state: 'running', intent: input.input });
  } finally {
    await test.runtime.dispose();
    await test.laneRuntime.dispose();
  }
});

it('cannot orphan an accepted request when the caller disconnects during publication', async () => {
  const controller = new AbortController();
  const test = await fixture(() => controller.abort());
  try {
    await Effect.runPromiseExit(test.useCase.execute(input), {
      signal: controller.signal,
    });
    await test.enqueued.promise;
    expect(test.queued).toEqual([input.requestId]);
    expect(
      await Effect.runPromise(
        test.receipts.read({ requestId: input.requestId }),
      ),
    ).toMatchObject({ state: 'running' });
  } finally {
    await test.runtime.dispose();
    await test.laneRuntime.dispose();
  }
});

it('rejects a reused request identity with a different Git target before enqueueing again', async () => {
  const test = await fixture();
  try {
    await Effect.runPromise(test.useCase.execute(input));
    const changed = await Effect.runPromiseExit(
      test.useCase.execute({
        ...input,
        input: { ...input.input, remoteName: 'another' },
      }),
    );
    expect(changed._tag).toBe('Failure');
    expect(test.queued).toEqual([input.requestId]);
  } finally {
    await test.runtime.dispose();
    await test.laneRuntime.dispose();
  }
});
