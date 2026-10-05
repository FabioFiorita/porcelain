import { Context, Effect, Layer } from 'effect';
import {
  type IdentifyRequestClientInput,
  type RequestClient,
} from '@porcelain/access/models';
import { IdentifyRequestClientService } from '@porcelain/access/services';
import { Lanes } from '../../runtime/lanes.ts';

export class IdentifyRequestClientUseCase extends Context.Service<
  IdentifyRequestClientUseCase,
  {
    readonly execute: (
      input: IdentifyRequestClientInput,
    ) => Effect.Effect<RequestClient, never>;
  }
>()('@porcelain/server/IdentifyRequestClientUseCase') {
  static readonly layer = Layer.effect(
    IdentifyRequestClientUseCase,
    Effect.gen(function* () {
      const identifyRequestClientCapability =
        yield* IdentifyRequestClientService;
      const lanesCapability = yield* Lanes;

      return {
        execute: Effect.fn('IdentifyRequestClientUseCase.execute')(function* (
          input: IdentifyRequestClientInput,
        ): Effect.fn.Return<RequestClient, never> {
          return yield* lanesCapability.unqueued(() =>
            Effect.gen(function* () {
              return yield* identifyRequestClientCapability.execute(input);
            }),
          );
        }),
      };
    }),
  );
}
