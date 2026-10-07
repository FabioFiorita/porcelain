import { Effect, Layer } from 'effect';
import type { PairingAttempts } from '@porcelain/access/models';
import { PairingAttemptStore } from '@porcelain/access/ports';

export const inMemoryPairingAttemptStoreLayer = Layer.effect(
  PairingAttemptStore,
  Effect.sync(() => {
    let attempts: PairingAttempts = { shared: undefined, peers: new Map() };
    return {
      read(): PairingAttempts {
        return attempts;
      },
      save(input: PairingAttempts): void {
        attempts = input;
      },
    };
  }),
);
