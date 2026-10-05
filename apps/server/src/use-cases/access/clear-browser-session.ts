import { Effect, Context, Layer } from 'effect';
import { type ClearBrowserSessionResponse } from '@porcelain/contracts/access';
import { Lanes } from '../../runtime/lanes.ts';

export class ClearBrowserSessionUseCase extends Context.Service<
  ClearBrowserSessionUseCase,
  { readonly execute: () => Effect.Effect<ClearBrowserSessionResponse, never> }
>()('@porcelain/server/ClearBrowserSessionUseCase') {
  static readonly layer = Layer.effect(
    ClearBrowserSessionUseCase,
    Effect.gen(function* () {
      const lanesCapability = yield* Lanes;

      return {
        execute: Effect.fn('ClearBrowserSessionUseCase.execute')(
          function* (): Effect.fn.Return<ClearBrowserSessionResponse, never> {
            return yield* lanesCapability.unqueued(() =>
              Effect.sync(() => {
                return undefined;
              }),
            );
          },
        ),
      };
    }),
  );
}
