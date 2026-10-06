import { Effect, Context, Layer } from 'effect';
import {
  type ReadSessionRequest,
  type ReadSessionResponse,
} from '@porcelain/contracts/access';
import { Lanes } from '../../runtime/lanes.ts';

export class ReadSessionUseCase extends Context.Service<
  ReadSessionUseCase,
  {
    readonly execute: (
      input: ReadSessionRequest,
    ) => Effect.Effect<ReadSessionResponse, never>;
  }
>()('@porcelain/server/ReadSessionUseCase') {
  static readonly layer = Layer.effect(
    ReadSessionUseCase,
    Effect.gen(function* () {
      const lanesCapability = yield* Lanes;

      return {
        execute: Effect.fn('ReadSessionUseCase.execute')(function* (
          input: ReadSessionRequest,
        ): Effect.fn.Return<ReadSessionResponse, never> {
          return yield* lanesCapability.unqueued(() =>
            Effect.sync(() => {
              return input.viewer;
            }),
          );
        }),
      };
    }),
  );
}
