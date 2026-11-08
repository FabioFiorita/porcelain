import { testClock } from '@porcelain/kernel/test-kit';
import {
  PairingAttemptBudgetStore,
  TakePairingAttemptOptions,
} from '@porcelain/access/ports';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import { TooManyPairingAttemptsError } from '@porcelain/access/errors';
import { InMemoryPairingAttemptStore } from '../../spec/fakes/in-memory-pairing-attempt-store.ts';
import { TakePairingAttemptService } from './take-pairing-attempt-service.ts';

const budget = {
  windowMs: 60_000,
  attemptsPerPeer: 10,
  attemptsOverall: 60,
  maxPeers: 1024,
};
const peer = '127.0.0.1';

async function setup() {
  return Effect.runSync(
    TakePairingAttemptService.pipe(
      Effect.provide(TakePairingAttemptService.layer),
      Effect.provideService(PairingAttemptBudgetStore, {
        sameOrigin: new InMemoryPairingAttemptStore(),
        crossOrigin: new InMemoryPairingAttemptStore(),
      }),
      Effect.provideService(
        Clock.Clock,
        await testClock('2026-09-30T10:00:00.000Z'),
      ),
      Effect.provideService(TakePairingAttemptOptions, {
        sameOrigin: budget,
        crossOrigin: { ...budget, attemptsPerPeer: 2, attemptsOverall: 3 },
      }),
    ),
  );
}

describe('TakePairingAttemptService', () => {
  it('keeps pages on other origins that exhaust their attempts from starving pairing from the same peer', async () => {
    const service = await setup();
    for (let attempt = 0; attempt < 2; attempt += 1)
      Effect.runSync(service.execute({ peer, crossOrigin: true }));
    expect(() =>
      Effect.runSync(service.execute({ peer, crossOrigin: true })),
    ).toThrow(TooManyPairingAttemptsError);
    expect(() =>
      Effect.runSync(service.execute({ peer, crossOrigin: false })),
    ).not.toThrow();
  });

  it('keeps exhausted same-origin attempts from blocking a cross-origin redemption', async () => {
    const service = await setup();
    for (let attempt = 0; attempt < 10; attempt += 1)
      Effect.runSync(service.execute({ peer, crossOrigin: false }));
    expect(() =>
      Effect.runSync(service.execute({ peer, crossOrigin: false })),
    ).toThrow(TooManyPairingAttemptsError);
    expect(() =>
      Effect.runSync(service.execute({ peer, crossOrigin: true })),
    ).not.toThrow();
  });

  it('holds cross-origin attempts to their own limits, per peer and overall', async () => {
    const service = await setup();
    Effect.runSync(service.execute({ peer: '10.0.0.1', crossOrigin: true }));
    Effect.runSync(service.execute({ peer: '10.0.0.1', crossOrigin: true }));
    expect(() =>
      Effect.runSync(service.execute({ peer: '10.0.0.1', crossOrigin: true })),
    ).toThrow(TooManyPairingAttemptsError);
    Effect.runSync(service.execute({ peer: '10.0.0.2', crossOrigin: true }));
    expect(() =>
      Effect.runSync(service.execute({ peer: '10.0.0.3', crossOrigin: true })),
    ).toThrow(TooManyPairingAttemptsError);
  });
});
