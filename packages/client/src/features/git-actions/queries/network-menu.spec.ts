import { Effect, Fiber } from 'effect';
import { expect, it } from 'vitest';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import { operationStoreFixture } from '../../../../spec/kit/operation-store.ts';
import { operationKey } from '../store/operations.ts';
import { networkMenuFeedback } from './network-menu.ts';

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

async function pendingPull() {
  const { store } = operationStoreFixture();
  await Effect.runPromise(
    store.set(operationKey(scope, 'pull'), {
      ...scope,
      requestId,
      request: {
        requestId,
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
  await Effect.runPromise(store.accept(receipt));
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
    expect(returned.retryAction).toBe('pull');
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
