import { Effect, Layer } from 'effect';
import type { PairingReach } from '@porcelain/access/models';
import { PairingReachReader, RouteStateStore } from '@porcelain/access/ports';

export const httpPairingReachReaderLayer = (reach: () => PairingReach) =>
  Layer.effect(
    PairingReachReader,
    Effect.gen(function* () {
      const routeStates = yield* RouteStateStore;
      return {
        current(): PairingReach {
          return { ...reach(), origins: routeStates.read().origins };
        },
      };
    }),
  );
