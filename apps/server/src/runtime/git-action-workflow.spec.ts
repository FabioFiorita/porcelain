import { nativeOperation } from '@porcelain/effects';
import { type GitActionReceipt } from '@porcelain/git-actions/models';
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { WorkflowEngine } from 'effect/workflow';
import { expect, it } from 'vitest';
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

async function fixture() {
  const started = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const settled = Promise.withResolvers<void>();
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
        nativeOperation((signal) => {
          calls += 1;
          signal.addEventListener(
            'abort',
            () => {
              aborts += 1;
              aborted.resolve();
            },
            { once: true },
          );
          started.resolve();
          return release.promise.then(() => {
            order.push('cleanup');
          });
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              order.push('settled');
              settled.resolve();
            }),
          ),
        ),
    }),
    WorkflowEngine.layerMemory,
  );
  const runtime = ManagedRuntime.make(
    GitActionWorkflow.layer.pipe(Layer.provide(ports)),
  );
  return {
    workflow: await runtime.runPromise(GitActionWorkflow),
    runtime,
    started,
    aborted,
    release,
    settled,
    order,
    calls: () => calls,
    aborts: () => aborts,
  };
}

it('keeps accepted native workflow execution alive when the requesting caller disconnects', async () => {
  const test = await fixture();
  try {
    const controller = new AbortController();
    const caller = Effect.runPromiseExit(
      test.workflow
        .execute({ requestId: receipt.requestId })
        .pipe(Effect.andThen(Effect.never)),
      { signal: controller.signal },
    );
    await test.started.promise;
    controller.abort();
    expect((await caller)._tag).toBe('Failure');
    expect(test.calls()).toBe(1);
    expect(test.aborts()).toBe(0);
    expect(test.order).toEqual([]);
    test.release.resolve();
    await test.settled.promise;
    expect(test.order).toEqual(['cleanup', 'settled']);
  } finally {
    test.release.resolve();
    await test.runtime.dispose();
  }
});

it('stops the owned native workflow and waits for foreign cleanup before returning', async () => {
  const test = await fixture();
  try {
    await Effect.runPromise(
      test.workflow.execute({ requestId: receipt.requestId }),
    );
    await test.started.promise;
    let stopped = false;
    const stopping = Effect.runPromise(test.workflow.stop()).then(() => {
      stopped = true;
    });
    await test.aborted.promise;
    expect(stopped).toBe(false);
    expect(test.order).toEqual([]);
    test.release.resolve();
    await stopping;
    expect(test.calls()).toBe(1);
    expect(test.aborts()).toBe(1);
    expect(test.order).toEqual(['cleanup', 'settled']);
    expect(stopped).toBe(true);
    expect(
      (
        await Effect.runPromiseExit(
          test.workflow.execute({ requestId: receipt.requestId }),
        )
      )._tag,
    ).toBe('Failure');
  } finally {
    test.release.resolve();
    await test.runtime.dispose();
  }
});
