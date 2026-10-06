import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { sampleReceipt } from '../../spec/fixtures/git-action-samples.ts';
import { InMemoryGitActionReceiptStore } from '../../spec/fakes/in-memory-git-action-receipt-store.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { ReadQueuedGitActionService } from './read-queued-git-action-service.ts';

it('resolves only the durable accepted request identity and preserves its terminal state', async () => {
  const receipt = { ...sampleReceipt(), state: 'interrupted' as const };
  const service = Effect.runSync(
    ReadQueuedGitActionService.pipe(
      Effect.provide(ReadQueuedGitActionService.layer),
      Effect.provideService(
        GitActionReceiptStore,
        new InMemoryGitActionReceiptStore([receipt]),
      ),
    ),
  );
  expect(
    await Effect.runPromise(
      service.execute({
        requestId: receipt.requestId,
        acceptedAt: receipt.acceptedAt,
      }),
    ),
  ).toMatchObject({
    kind: 'ready',
    receipt: {
      requestId: receipt.requestId,
      acceptedAt: receipt.acceptedAt,
      state: 'interrupted',
      intent: receipt.intent,
    },
  });
  expect(
    await Effect.runPromise(
      service.execute({
        requestId: receipt.requestId,
        acceptedAt: '2026-10-06T00:00:00.000Z',
      }),
    ),
  ).toEqual({ kind: 'unavailable' });
  expect(
    await Effect.runPromise(
      service.execute({ requestId: 'missing', acceptedAt: receipt.acceptedAt }),
    ),
  ).toEqual({ kind: 'unavailable' });
});
