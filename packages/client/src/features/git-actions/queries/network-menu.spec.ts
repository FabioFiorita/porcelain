import { Effect, Fiber } from 'effect';
import { expect, it } from 'vite-plus/test';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import { operationStoreFixture } from '../../../../spec/kit/operation-store.ts';
import { operationKey } from '../store/operations.ts';
import {
  networkMenuFeedback,
  networkSuccesses,
  watchNetworkSuccesses,
} from './network-menu.ts';

const scope = {
  projectId: '11111111-1111-4111-8111-111111111111',
  worktreeId: 'a'.repeat(32),
};
const requestId = '22222222-2222-4222-8222-222222222222';
const receipt: RunGitActionResponse = {
  ...scope,
  requestId,
  action: 'pull',
  state: 'running',
  progress: ['Receiving objects'],
  acceptedAt: '2026-11-10T10:00:00.000Z',
};

async function pendingPull(id = requestId) {
  const { store } = operationStoreFixture();
  await Effect.runPromise(
    store.set(operationKey(scope, 'pull'), {
      ...scope,
      requestId: id,
      request: {
        requestId: id,
        input: {
          action: 'pull',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
          strategy: 'merge',
        },
        expected: {
          headOid: undefined,
          branch: undefined,
          inProgress: undefined,
          mergeHeadOid: undefined,
        },
      },
    }),
  );
  await Effect.runPromise(store.accept({ ...receipt, requestId: id }));
  return store;
}

it('keeps Check outcome available while the first Pull waits for its terminal receipt', async () => {
  const store = await pendingPull();
  const waiter = Effect.runFork(
    store.wait(operationKey(scope, 'pull'), requestId),
  );
  try {
    const feedback = networkMenuFeedback(store.state.value, scope);
    expect(feedback.running?.action).toBe('pull');
    expect(feedback.running?.operation.receipt?.progress).toEqual([
      'Receiving objects',
    ]);
    expect(feedback.result).toBeNull();
    expect(waiter.pollUnsafe()).toBeUndefined();
    await Effect.runPromise(store.accept({ ...receipt, state: 'succeeded' }));
    expect(await Effect.runPromise(Fiber.join(waiter))).toMatchObject({
      state: 'succeeded',
    });
    expect(
      networkMenuFeedback(store.state.value, scope).running,
    ).toBeUndefined();
  } finally {
    await Effect.runPromise(Fiber.interrupt(waiter));
  }
});

it('retries the recovered rejected Pull rather than the older Fetch', async () => {
  const store = await pendingPull();
  await Effect.runPromise(
    store.set(operationKey(scope, 'fetch'), {
      ...scope,
      requestId: '33333333-3333-4333-8333-333333333333',
      request: {
        requestId: '33333333-3333-4333-8333-333333333333',
        input: {
          action: 'fetch',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
        },
        expected: {
          headOid: undefined,
          branch: undefined,
          inProgress: undefined,
          mergeHeadOid: undefined,
        },
      },
      receipt: {
        ...receipt,
        action: 'fetch',
        state: 'succeeded',
        acceptedAt: '2026-11-10T09:00:00.000Z',
      },
    }),
  );
  await Effect.runPromise(
    store.accept({
      ...receipt,
      state: 'rejected',
      message: 'Remote unavailable',
    }),
  );
  const reopened = networkMenuFeedback(store.state.value, scope);
  expect(reopened.result).toEqual({
    title: 'Pull did not run',
    description: 'Remote unavailable',
    type: 'error',
  });
  expect(reopened.retryAction).toBe('pull');
});

it.each(['succeeded', 'rejected'] as const)(
  'shows a %s Pull that arrived while History was unmounted, only in its workspace',
  async (state) => {
    const store = await pendingPull();
    expect(networkMenuFeedback(store.state.value, scope).running?.action).toBe(
      'pull',
    );
    await Effect.runPromise(
      store.accept({
        ...receipt,
        state,
        message:
          state === 'rejected' ? 'Remote refused Pull' : 'Pulled one commit',
      }),
    );
    const returned = networkMenuFeedback(store.state.value, scope);
    expect(returned.running).toBeUndefined();
    expect(returned.result).toEqual({
      title: state === 'rejected' ? 'Pull did not run' : 'Pull',
      description:
        state === 'rejected' ? 'Remote refused Pull' : 'Pulled one commit',
      type: state === 'rejected' ? 'error' : 'success',
    });
    expect(returned.retryAction).toBe(
      state === 'rejected' ? 'pull' : undefined,
    );
    expect(
      networkMenuFeedback(store.state.value, {
        ...scope,
        worktreeId: 'b'.repeat(32),
      }).result,
    ).toBeNull();
  },
);

it('replaces a retained recovery error when a later terminal receipt arrives', async () => {
  const store = await pendingPull();
  const notice = {
    action: 'pull' as const,
    notice: {
      title: 'Pull outcome not confirmed',
      description: 'Computer offline',
      type: 'error' as const,
    },
    operation: store.state.value.operations.get(operationKey(scope, 'pull')),
  };
  expect(
    networkMenuFeedback(store.state.value, scope, notice).result?.description,
  ).toBe('Computer offline');
  await Effect.runPromise(
    store.accept({
      ...receipt,
      state: 'succeeded',
      message: 'Pulled one commit',
    }),
  );
  expect(networkMenuFeedback(store.state.value, scope, notice).result).toEqual({
    title: 'Pull',
    description: 'Pulled one commit',
    type: 'success',
  });
});

it('keeps Check outcome success authoritative when the original Pull later rejects', async () => {
  const store = await pendingPull();
  await Effect.runPromise(
    store.accept({
      ...receipt,
      state: 'succeeded',
      message: 'Pulled one commit',
    }),
  );
  const originalRequestError = {
    action: 'pull' as const,
    notice: {
      title: 'Pull outcome not confirmed',
      description: 'Original request disconnected',
      type: 'error' as const,
    },
    operation: store.state.value.operations.get(operationKey(scope, 'pull')),
  };
  const history = networkMenuFeedback(
    store.state.value,
    scope,
    originalRequestError,
  );
  expect(history.result).toEqual({
    title: 'Pull',
    description: 'Pulled one commit',
    type: 'success',
  });
  expect(history.retryAction).toBeUndefined();
});

it('reports a Pull success once, when its request turns terminal, whichever path delivers it', async () => {
  const store = await pendingPull();
  const pending = store.state.value;
  const success = { ...receipt, state: 'succeeded' as const, progress: [] };
  await Effect.runPromise(store.accept(success));
  const done = store.state.value;
  expect(networkSuccesses(pending, done)).toEqual([
    { action: 'pull', requestId },
  ]);
  await Effect.runPromise(store.accept(success));
  expect(networkSuccesses(done, store.state.value)).toEqual([]);
});

it('reports nothing for a failed Pull or a success already terminal when first seen', async () => {
  const store = await pendingPull();
  const pending = store.state.value;
  await Effect.runPromise(
    store.accept({ ...receipt, state: 'rejected', progress: [] }),
  );
  expect(networkSuccesses(pending, store.state.value)).toEqual([]);
  const { store: restored } = operationStoreFixture();
  const empty = restored.state.value;
  await Effect.runPromise(
    restored.set(operationKey(scope, 'pull'), {
      ...pending.operations.get(operationKey(scope, 'pull'))!,
      receipt: { ...receipt, state: 'succeeded', progress: [] },
    }),
  );
  expect(networkSuccesses(empty, restored.state.value)).toEqual([]);
});

it('announces each Fetch or Pull success once for every paired computer, whichever screen is open', async () => {
  const first = await pendingPull();
  const listeners = new Set<() => void>();
  const connections = {
    value: [{ operations: { state: first.state } }],
    subscribe: (changed: () => void) => {
      listeners.add(changed);
      return () => listeners.delete(changed);
    },
    set(next: typeof this.value) {
      this.value = next;
      for (const changed of listeners) changed();
    },
  };
  const announced: string[] = [];
  const stop = watchNetworkSuccesses(connections, (action) =>
    announced.push(action),
  );
  try {
    const success = { ...receipt, state: 'succeeded' as const, progress: [] };
    await Effect.runPromise(first.accept(success));
    await Effect.runPromise(first.accept(success));
    expect(announced).toEqual(['pull']);
    const otherRequest = '33333333-3333-4333-8333-333333333333';
    const second = await pendingPull(otherRequest);
    connections.set([
      { operations: { state: first.state } },
      { operations: { state: second.state } },
    ]);
    await Effect.runPromise(
      second.accept({ ...success, requestId: otherRequest }),
    );
    expect(announced).toEqual(['pull', 'pull']);
  } finally {
    stop();
  }
});
