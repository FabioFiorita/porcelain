import { Clock, Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import { testClock } from '@porcelain/kernel/test-kit';
import { sampleReceipt } from '../../spec/fixtures/git-action-samples.ts';
import { InMemoryGitActionReceiptStore } from '../../spec/fakes/in-memory-git-action-receipt-store.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { BeginGitActionService } from './begin-git-action-service.ts';

async function begin(store: InMemoryGitActionReceiptStore) {
  const ports = Layer.mergeAll(
    Layer.succeed(GitActionReceiptStore, store),
    Layer.succeed(Clock.Clock, await testClock('2026-10-06T00:00:00.000Z')),
  );
  return Effect.runSync(
    BeginGitActionService.pipe(
      Effect.provide(BeginGitActionService.layer.pipe(Layer.provide(ports))),
    ),
  );
}

it('starts an accepted exact request once and refuses replay after a crash', async () => {
  const receipt = sampleReceipt();
  const store = new InMemoryGitActionReceiptStore();
  await Effect.runPromise(store.insert(receipt));
  const service = await begin(store);
  const first = await Effect.runPromise(
    service.execute({
      requestId: receipt.requestId,
      acceptedAt: receipt.acceptedAt,
    }),
  );
  expect(first).toMatchObject({
    kind: 'ready',
    run: { requestId: receipt.requestId, intent: receipt.intent },
  });
  expect(
    await Effect.runPromise(
      service.execute({
        requestId: receipt.requestId,
        acceptedAt: receipt.acceptedAt,
      }),
    ),
  ).toEqual({ kind: 'unavailable' });
  expect(
    await Effect.runPromise(store.read({ requestId: receipt.requestId })),
  ).toMatchObject({
    state: 'interrupted',
    reason: 'OUTCOME_UNKNOWN',
    refreshRequired: true,
  });
});

it('refuses legacy running receipts whose write history has no durable fence', async () => {
  const receipt = sampleReceipt();
  const store = new InMemoryGitActionReceiptStore([receipt]);
  const service = await begin(store);
  expect(
    await Effect.runPromise(
      service.execute({
        requestId: receipt.requestId,
        acceptedAt: receipt.acceptedAt,
      }),
    ),
  ).toEqual({ kind: 'unavailable' });
  expect(
    await Effect.runPromise(store.read({ requestId: receipt.requestId })),
  ).toMatchObject({
    state: 'interrupted',
    reason: 'OUTCOME_UNKNOWN',
  });
});

it('keeps a terminal receipt unchanged when the native Activity reply was lost', async () => {
  const receipt = sampleReceipt({
    state: 'succeeded',
    finishedAt: '2026-10-05T00:00:00.000Z',
  });
  const store = new InMemoryGitActionReceiptStore([receipt]);
  const service = await begin(store);
  expect(
    await Effect.runPromise(
      service.execute({
        requestId: receipt.requestId,
        acceptedAt: receipt.acceptedAt,
      }),
    ),
  ).toEqual({ kind: 'unavailable' });
  expect(
    await Effect.runPromise(store.read({ requestId: receipt.requestId })),
  ).toEqual(receipt);
});
