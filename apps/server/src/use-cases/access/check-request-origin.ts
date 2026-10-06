import { Context, Effect, Layer } from 'effect';
import { type CheckRequestOriginInput } from '@porcelain/access/models';
import { CheckRequestOriginService } from '@porcelain/access/services';
import { Lanes } from '../../runtime/lanes.ts';
import { type RequestOriginVerdict } from '../../ports/check-request-origin-use-case-port.ts';

export class CheckRequestOriginUseCase extends Context.Service<
  CheckRequestOriginUseCase,
  {
    readonly execute: (
      input: CheckRequestOriginInput,
    ) => Effect.Effect<RequestOriginVerdict, never>;
  }
>()('@porcelain/server/CheckRequestOriginUseCase') {
  static readonly layer = Layer.effect(
    CheckRequestOriginUseCase,
    Effect.gen(function* () {
      const checkRequestOriginCapability = yield* CheckRequestOriginService;
      const lanesCapability = yield* Lanes;

      return {
        execute: Effect.fn('CheckRequestOriginUseCase.execute')(function* (
          input: CheckRequestOriginInput,
        ): Effect.fn.Return<RequestOriginVerdict, never> {
          return yield* lanesCapability.unqueued(() =>
            Effect.gen(function* () {
              const result = yield* checkRequestOriginCapability.execute(input);
              return result.kind === 'allowed'
                ? { allowed: true as const, crossOrigin: result.crossOrigin }
                : { allowed: false as const, refusal: result.refusal };
            }),
          );
        }),
      };
    }),
  );
}
