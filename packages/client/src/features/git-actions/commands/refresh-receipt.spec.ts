import { AtomRegistry, AsyncResult, Reactivity } from 'effect/reactivity';
import { Layer, Context, Effect, Fiber, Option } from 'effect';
import { expect, it } from 'vitest';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import {
  createWorktreeConnection,
  queryKeys,
  type Transport,
} from '@porcelain/client/transport';
import { readChanges } from '@porcelain/client/changes';
import { GitReceiptRefresh, receiptRuntime } from './refresh-receipt.ts';

const receipt: RunGitActionResponse = {
  projectId: '11111111-1111-4111-8111-111111111111',
  worktreeId: '0123456789abcdef0123456789abcdef',
  requestId: '22222222-2222-4222-8222-222222222222',
  action: 'fetch',
  state: 'succeeded',
  acceptedAt: '2026-10-05T10:00:00.000Z',
  progress: [],
};
const before = {
  environmentId: '44444444-4444-4444-8444-444444444444',
  worktreeId: receipt.worktreeId,
  statusToken: 'a'.repeat(64),
  headOid: null,
  branch: null,
  inProgress: null,
  mergeHeadOid: null,
  changes: [],
};
const after = { ...before, statusToken: 'b'.repeat(64) };

async function setup(transport: Transport) {
  const lifetime = createWorktreeConnection(
    {
      environmentId: '44444444-4444-4444-8444-444444444444',
      transport,
      timeoutMs: 1000,
    },
    undefined,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  const runtime = receiptRuntime(lifetime.connection);
  const stopRuntime = registry.mount(runtime);
  const query = readChanges({
    connection: lifetime.connection,
    scope: receipt,
  });
  const stopQuery = registry.mount(query);
  const services = await Effect.runPromise(
    AtomRegistry.getResult(registry, runtime),
  );
  await Effect.runPromise(AtomRegistry.getResult(registry, query));
  return {
    registry,
    query,
    refresh: Context.get(services, GitReceiptRefresh).refresh,
    reactivity: Context.get(services, Reactivity.Reactivity),
    close: async () => {
      stopQuery();
      stopRuntime();
      registry.dispose();
      await lifetime.close();
    },
  };
}

it('coalesces a live receipt with its command, keeps refreshing when one waiter closes, and permits a later fresh read', async () => {
  const { subject, started, answer, readCount } = await heldRefresh();
  let inventoryRefreshes = 0;
  const unregister = subject.reactivity.registerUnsafe(
    [queryKeys.inventory('44444444-4444-4444-8444-444444444444')],
    () => {
      inventoryRefreshes++;
    },
  );
  try {
    const command = Effect.runFork(subject.refresh(receipt));
    await started.promise;
    const notice = Effect.runFork(subject.refresh({ ...receipt }));
    await Effect.runPromise(Fiber.interrupt(command));
    expect(readCount()).toBe(2);
    expect(inventoryRefreshes).toBe(1);
    expect(
      Option.getOrThrow(AsyncResult.value(subject.registry.get(subject.query)))
        .statusToken,
    ).toBe('a'.repeat(64));
    answer.resolve(Response.json(after));
    await Effect.runPromise(Fiber.join(notice));
    expect(
      Option.getOrThrow(AsyncResult.value(subject.registry.get(subject.query)))
        .statusToken,
    ).toBe('b'.repeat(64));
    await Effect.runPromise(subject.refresh(receipt));
    expect(readCount()).toBe(3);
    expect(inventoryRefreshes).toBe(2);
  } finally {
    answer.resolve(Response.json(after));
    unregister();
    await subject.close();
  }
});

it('finishes an admitted refresh after its last waiter cancels without starting another refresh for the live receipt', async () => {
  const { subject, started, answer, readCount } = await heldRefresh();
  try {
    const command = Effect.runFork(subject.refresh(receipt));
    await started.promise;
    await Effect.runPromise(Fiber.interrupt(command));
    const notice = Effect.runFork(subject.refresh({ ...receipt }));
    answer.resolve(Response.json(after));
    await Effect.runPromise(Fiber.join(notice));
    expect(readCount()).toBe(2);
    expect(
      Option.getOrThrow(AsyncResult.value(subject.registry.get(subject.query)))
        .statusToken,
    ).toBe('b'.repeat(64));
  } finally {
    answer.resolve(Response.json(after));
    await subject.close();
  }
});

it.each(['running', 'rejected', 'no-change'] as const)(
  'keeps confirmed caches intact for a %s receipt',
  async (state) => {
    let reads = 0;
    const subject = await setup(() => {
      reads++;
      return Promise.resolve(Response.json(before));
    });
    let refreshes = 0;
    const unregister = subject.reactivity.registerUnsafe(
      [queryKeys.inventory('44444444-4444-4444-8444-444444444444')],
      () => {
        refreshes++;
      },
    );
    try {
      await Effect.runPromise(subject.refresh({ ...receipt, state }));
      expect(reads).toBe(1);
      expect(refreshes).toBe(0);
      expect(
        Option.getOrThrow(
          AsyncResult.value(subject.registry.get(subject.query)),
        ).statusToken,
      ).toBe('a'.repeat(64));
    } finally {
      unregister();
      await subject.close();
    }
  },
);

async function heldRefresh() {
  const started = Promise.withResolvers<void>();
  const answer = Promise.withResolvers<Response>();
  let reads = 0;
  const subject = await setup(() => {
    if (++reads === 1) return Promise.resolve(Response.json(before));
    started.resolve();
    return answer.promise;
  });
  return { subject, started, answer, readCount: () => reads };
}
