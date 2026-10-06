import { Context, Effect, Layer } from 'effect';
import { type RefundPairingAttemptInput } from '@porcelain/access/models';
import { RefundPairingAttemptService } from '@porcelain/access/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RefundPairingAttemptUseCase extends Context.Service<
  RefundPairingAttemptUseCase,
  {
    readonly execute: (
      input: RefundPairingAttemptInput,
    ) => Effect.Effect<void, never>;
  }
>()('@porcelain/server/RefundPairingAttemptUseCase') {
  static readonly layer = Layer.effect(
    RefundPairingAttemptUseCase,
    Effect.gen(function* () {
      const refundPairingAttemptCapability = yield* RefundPairingAttemptService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('RefundPairingAttemptUseCase.execute')(function* (
          input: RefundPairingAttemptInput,
        ): Effect.fn.Return<void, never> {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                return yield* refundPairingAttemptCapability.execute(input);
              }),
          );
        }),
      };
    }),
  );
}
