import { Context, Effect, Layer, Redacted } from 'effect';
import {
  type InvalidPairingError,
  type InvalidDeviceDetailsError,
} from '@porcelain/access/errors';
import { RedeemPairingService } from '@porcelain/access/services';
import {
  type RedeemPairingInput,
  type RedeemPairingResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RedeemPairingUseCase extends Context.Service<
  RedeemPairingUseCase,
  {
    readonly execute: (
      input: RedeemPairingInput,
    ) => Effect.Effect<
      RedeemPairingResponse,
      InvalidPairingError | InvalidDeviceDetailsError
    >;
  }
>()('@porcelain/server/RedeemPairingUseCase') {
  static readonly layer = Layer.effect(
    RedeemPairingUseCase,
    Effect.gen(function* () {
      const redeemPairingCapability = yield* RedeemPairingService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('RedeemPairingUseCase.execute')(function* (
          input: RedeemPairingInput,
        ): Effect.fn.Return<
          RedeemPairingResponse,
          InvalidPairingError | InvalidDeviceDetailsError
        > {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                const paired = yield* redeemPairingCapability.execute(input);
                return {
                  ...paired,
                  credential: Redacted.value(paired.credential),
                };
              }),
          );
        }),
      };
    }),
  );
}
