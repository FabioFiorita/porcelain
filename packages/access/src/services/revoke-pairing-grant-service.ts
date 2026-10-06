import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import type {
  RevokePairingGrantInput,
  RevokePairingGrantResult,
} from '../models/revoke-pairing-grant.ts';
import { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import { pairingGrantRevocable } from '../rules/pairing-grant.ts';

export class RevokePairingGrantService extends Context.Service<
  RevokePairingGrantService,
  {
    readonly execute: (
      input: RevokePairingGrantInput,
    ) => Effect.Effect<RevokePairingGrantResult, never>;
  }
>()('@porcelain/access/RevokePairingGrantService') {
  static readonly layer = Layer.effect(
    RevokePairingGrantService,
    Effect.gen(function* () {
      const pairingGrants = yield* PairingGrantStore;
      const clock = yield* Clock.Clock;

      return {
        execute: Effect.fn('RevokePairingGrantService.execute')(function* (
          input: RevokePairingGrantInput,
        ): Effect.fn.Return<RevokePairingGrantResult, never> {
          const grant = yield* pairingGrants.find({ grantId: input.id });
          if (!grant || !pairingGrantRevocable(grant))
            return { kind: 'not-revoked' };
          yield* pairingGrants.markRevoked({
            grant,
            revokedAt: DateTime.formatIso(
              DateTime.makeUnsafe(yield* clock.currentTimeMillis),
            ),
          });
          return { kind: 'revoked' };
        }),
      };
    }),
  );
}
