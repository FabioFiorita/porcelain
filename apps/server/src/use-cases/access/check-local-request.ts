import { Context, Effect, Layer } from 'effect';
import {
  type CheckLocalRequestInput,
  type CheckLocalRequestResult,
} from '@porcelain/access/models';
import { CheckLocalRequestService } from '@porcelain/access/services';
import { Lanes } from '../../runtime/lanes.ts';

export class CheckLocalRequestUseCase extends Context.Service<
  CheckLocalRequestUseCase,
  {
    readonly execute: (
      input: CheckLocalRequestInput,
    ) => Effect.Effect<CheckLocalRequestResult, never>;
  }
>()('@porcelain/server/CheckLocalRequestUseCase') {
  static readonly layer = Layer.effect(
    CheckLocalRequestUseCase,
    Effect.gen(function* () {
      const checkLocalRequestCapability = yield* CheckLocalRequestService;
      const lanesCapability = yield* Lanes;

      return {
        execute: Effect.fn('CheckLocalRequestUseCase.execute')(function* (
          input: CheckLocalRequestInput,
        ): Effect.fn.Return<CheckLocalRequestResult, never> {
          return yield* lanesCapability.unqueued(() =>
            Effect.gen(function* () {
              return yield* checkLocalRequestCapability.execute(input);
            }),
          );
        }),
      };
    }),
  );
}
