import { Clock } from '@porcelain/kernel/ports';
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import { Effect } from 'effect';
import { GitActionNotFoundError } from '@porcelain/git-actions/errors';
import { FixedClock } from '@porcelain/kernel/fakes';
import { describe, expect, it } from 'vitest';
import {
  REQUEST_ID,
  sampleReceipt,
} from '../../spec/fixtures/git-action-samples.ts';
import { InMemoryGitActionReceiptStore } from '../../spec/fakes/in-memory-git-action-receipt-store.ts';
import { InterruptGitActionService } from './interrupt-git-action-service.ts';

const interruptedAt = '2026-09-23T12:01:00.000Z';

function subject(receipt = sampleReceipt()) {
  const store = new InMemoryGitActionReceiptStore([receipt]);
  return {
    store,
    service: Effect.runSync(
      InterruptGitActionService.pipe(
        Effect.provide(InterruptGitActionService.layer),
        Effect.provideService(GitActionReceiptStore, store),
        Effect.provideService(Clock, new FixedClock(interruptedAt)),
      ),
    ),
  };
}

describe('InterruptGitActionService', () => {
  it('settles a running action as interrupted with an unknown outcome', async () => {
    const { store, service } = subject();
    const view = Effect.runSync(service.execute({ requestId: REQUEST_ID }));
    expect(view).toMatchObject({
      state: 'interrupted',
      reason: 'OUTCOME_UNKNOWN',
      finishedAt: interruptedAt,
    });
    expect(
      await Effect.runPromise(store.read({ requestId: REQUEST_ID })),
    ).toMatchObject({
      state: 'interrupted',
      refreshRequired: true,
    });
  });

  it('leaves an action that already settled as it was', async () => {
    const settled = sampleReceipt({
      state: 'succeeded',
      finishedAt: '2026-09-23T12:00:00.000Z',
    });
    const { store, service } = subject(settled);
    expect(
      Effect.runSync(service.execute({ requestId: REQUEST_ID })).state,
    ).toBe('succeeded');
    expect(
      await Effect.runPromise(store.read({ requestId: REQUEST_ID })),
    ).toEqual(settled);
  });

  it('does not find a request it never accepted', () => {
    const { service } = subject();
    expect(() =>
      Effect.runSync(
        service.execute({ requestId: 'e0c7a0f4-3b1c-4b58-9a57-4b3cf6f6b0d1' }),
      ),
    ).toThrow(GitActionNotFoundError);
  });
});
