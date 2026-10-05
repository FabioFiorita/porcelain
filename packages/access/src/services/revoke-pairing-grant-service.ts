import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
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
      const clock = yield* Clock;

      return {
        execute: Effect.fn('RevokePairingGrantService.execute')(function* (
          input: RevokePairingGrantInput,
        ): Effect.fn.Return<RevokePairingGrantResult, never> {
          return yield* Effect.sync<RevokePairingGrantResult>(() => {
            const grant = pairingGrants.find({ grantId: input.id });
            if (!grant || !pairingGrantRevocable(grant))
              return { kind: 'not-revoked' };
            pairingGrants.markRevoked({ grant, revokedAt: clock.now() });
            return { kind: 'revoked' };
          });
        }),
      };
    }),
  );
}
