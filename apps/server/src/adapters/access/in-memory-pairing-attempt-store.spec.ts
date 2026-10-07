import { PairingAttemptStore } from '@porcelain/access/ports';
import { Effect } from 'effect';
import { describe, expect, it } from '@effect/vitest';
import { inMemoryPairingAttemptStoreLayer } from './in-memory-pairing-attempt-store.ts';

describe('InMemoryPairingAttemptStore', () => {
  it.effect('reads no attempts before any are saved', () =>
    Effect.gen(function* () {
      expect((yield* PairingAttemptStore).read()).toEqual({
        shared: undefined,
        peers: new Map(),
      });
    }).pipe(Effect.provide(inMemoryPairingAttemptStoreLayer)),
  );

  it.effect(
    'reads back the attempts saved last, replacing the earlier ones',
    () =>
      Effect.gen(function* () {
        const store = yield* PairingAttemptStore;
        store.save({
          shared: { tokens: 4, at: '2026-09-24T10:00:00.000Z' },
          peers: new Map([
            ['192.168.1.10', { tokens: 1, at: '2026-09-24T10:00:00.000Z' }],
          ]),
        });
        const latest = {
          shared: { tokens: 3, at: '2026-09-24T10:01:00.000Z' },
          peers: new Map([
            ['192.168.1.20', { tokens: 0, at: '2026-09-24T10:01:00.000Z' }],
          ]),
        };
        store.save(latest);
        expect(store.read()).toEqual(latest);
      }).pipe(Effect.provide(inMemoryPairingAttemptStoreLayer)),
  );
});
