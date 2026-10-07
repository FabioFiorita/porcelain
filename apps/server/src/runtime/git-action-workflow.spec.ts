import { type GitActionReceipt } from '@porcelain/git-actions/models';
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import { Context, Deferred, Effect, Exit, Fiber, Layer } from 'effect';
import { WorkflowEngine } from 'effect/workflow';
import { expect, it } from '@effect/vitest';
import { RunQueuedGitActionUseCasePort } from '../ports/run-queued-git-action-use-case-port.ts';
import { GitActionWorkflow } from './git-action-workflow.ts';

const receipt: GitActionReceipt = {
  requestId: '8d349263-380b-4f05-946c-09f8220e5c93',
  projectId: '24f5e56c-3bf6-4cf2-bf34-2d3b58023d53',
  worktreeId: '0123456789abcdef0123456789abcdef',
  action: 'fetch',
  intent: {
    action: 'fetch',
    remoteName: 'origin',
    sourceRef: 'refs/heads/main',
  },
  expected: { upstream: {} },
  state: 'running',
  progress: [],
  refreshRequired: false,
  acceptedAt: '2026-10-05T05:00:00.000Z',
};

const fixture = Effect.fn(function* () {
  const started = yield* Deferred.make<void>();
  const aborted = yield* Deferred.make<void>();
  const release = yield* Deferred.make<void>();
  const settled = yield* Deferred.make<void>();
  const order: string[] = [];
  let calls = 0;
  let aborts = 0;
  const unavailable = () =>
    Effect.die(new Error('Workflow must delegate domain mutations'));
  const ports = Layer.mergeAll(
    Layer.succeed(GitActionReceiptStore, {
      read: ({ requestId }) =>
        Effect.succeed(requestId === receipt.requestId ? receipt : undefined),
      running: () => Effect.succeed([receipt]),
      insert: unavailable,
      save: unavailable,
      claimExecution: unavailable,
      latestInterrupted: unavailable,
      finished: unavailable,
      remove: unavailable,
    }),
    Layer.succeed(RunQueuedGitActionUseCasePort, {
      execute: () =>
        Effect.gen(function* () {
          calls += 1;
          yield* Deferred.succeed(started, undefined);
          yield* Deferred.await(release).pipe(
            Effect.onInterrupt(() =>
              Effect.gen(function* () {
                aborts += 1;
                yield* Deferred.succeed(aborted, undefined);
                yield* Deferred.await(release);
              }),
            ),
            Effect.ensuring(
              Effect.gen(function* () {
                order.push('cleanup');
                order.push('settled');
                yield* Deferred.succeed(settled, undefined);
              }),
            ),
          );
        }),
    }),
    WorkflowEngine.layerMemory,
  );
  const context = yield* Layer.build(
    GitActionWorkflow.layer.pipe(Layer.provide(ports)),
  );
  return {
    workflow: Context.get(context, GitActionWorkflow),
    started,
    aborted,
    release,
    settled,
    order,
    calls: () => calls,
    aborts: () => aborts,
  };
});

it.effect(
  'keeps accepted workflow execution alive when the requesting caller disconnects',
  () =>
    Effect.gen(function* () {
      const test = yield* fixture();
      const caller = yield* Effect.forkChild(
        test.workflow
          .execute({ requestId: receipt.requestId })
          .pipe(Effect.andThen(Effect.never)),
      );
      yield* Deferred.await(test.started);
      yield* Fiber.interrupt(caller);
      expect(Exit.hasInterrupts(yield* Fiber.await(caller))).toBe(true);
      expect(test.calls()).toBe(1);
      expect(test.aborts()).toBe(0);
      expect(test.order).toEqual([]);
      yield* Deferred.succeed(test.release, undefined);
      yield* Deferred.await(test.settled);
      expect(test.order).toEqual(['cleanup', 'settled']);
    }),
);

it.effect(
  'stops the owned workflow and waits for cleanup before returning',
  () =>
    Effect.gen(function* () {
      const test = yield* fixture();
      yield* test.workflow.execute({ requestId: receipt.requestId });
      yield* Deferred.await(test.started);
      const stopping = yield* Effect.forkChild(test.workflow.stop());
      yield* Deferred.await(test.aborted);
      expect(stopping.pollUnsafe()).toBeUndefined();
      expect(test.order).toEqual([]);
      yield* Deferred.succeed(test.release, undefined);
      yield* Fiber.join(stopping);
      expect(test.calls()).toBe(1);
      expect(test.aborts()).toBe(1);
      expect(test.order).toEqual(['cleanup', 'settled']);
      expect(
        Exit.isFailure(
          yield* Effect.exit(
            test.workflow.execute({ requestId: receipt.requestId }),
          ),
        ),
      ).toBe(true);
    }),
);
