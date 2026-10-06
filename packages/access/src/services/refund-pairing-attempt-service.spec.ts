import { testClock } from '@porcelain/kernel/test-kit';
import {
  PairingAttemptBudgetStore,
  RefundPairingAttemptOptions,
} from '@porcelain/access/ports';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryPairingAttemptStore } from '../../spec/fakes/in-memory-pairing-attempt-store.ts';
import { RefundPairingAttemptService } from './refund-pairing-attempt-service.ts';

const budget = {
  windowMs: 60_000,
  attemptsPerPeer: 10,
  attemptsOverall: 60,
  maxPeers: 1024,
};
const at = '2026-09-30T10:00:00.000Z';
const peer = '127.0.0.1';

async function setup() {
  const stores = {
    sameOrigin: new InMemoryPairingAttemptStore(),
    crossOrigin: new InMemoryPairingAttemptStore(),
  };
  const spent = { tokens: 4, at };
  stores.sameOrigin.save({ shared: spent, peers: new Map([[peer, spent]]) });
  stores.crossOrigin.save({ shared: spent, peers: new Map([[peer, spent]]) });
  const service = Effect.runSync(
    RefundPairingAttemptService.pipe(
      Effect.provide(RefundPairingAttemptService.layer),
      Effect.provideService(PairingAttemptBudgetStore, stores),
      Effect.provideService(Clock.Clock, await testClock(at)),
      Effect.provideService(RefundPairingAttemptOptions, {
        sameOrigin: budget,
        crossOrigin: budget,
      }),
    ),
  );
  return { stores, service };
}

describe('RefundPairingAttemptService', () => {
  it('gives a cross-origin success its attempt back in the cross-origin budget only', async () => {
    const { stores, service } = await setup();
    Effect.runSync(service.execute({ peer, crossOrigin: true }));
    expect(stores.crossOrigin.read().peers.get(peer)?.tokens).toBe(5);
    expect(stores.sameOrigin.read().peers.get(peer)?.tokens).toBe(4);
  });

  it('gives a same-origin success its attempt back in the same-origin budget only', async () => {
    const { stores, service } = await setup();
    Effect.runSync(service.execute({ peer, crossOrigin: false }));
    expect(stores.sameOrigin.read().peers.get(peer)?.tokens).toBe(5);
    expect(stores.crossOrigin.read().peers.get(peer)?.tokens).toBe(4);
  });
});
