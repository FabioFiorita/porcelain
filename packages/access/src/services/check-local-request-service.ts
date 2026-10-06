import { Effect, Context, Layer } from 'effect';
import type {
  CheckLocalRequestInput,
  CheckLocalRequestResult,
} from '../models/check-local-request.ts';
import { localRequest } from '../rules/local-request.ts';

export class CheckLocalRequestService extends Context.Service<
  CheckLocalRequestService,
  {
    readonly execute: (
      input: CheckLocalRequestInput,
    ) => Effect.Effect<CheckLocalRequestResult, never>;
  }
>()('@porcelain/access/CheckLocalRequestService') {
  static readonly layer = Layer.effect(
    CheckLocalRequestService,
    Effect.sync(() => {
      return {
        execute: Effect.fn('CheckLocalRequestService.execute')(function* (
          input: CheckLocalRequestInput,
        ): Effect.fn.Return<CheckLocalRequestResult, never> {
          return yield* Effect.sync<CheckLocalRequestResult>(() => {
            return localRequest(input) ? { kind: 'local' } : { kind: 'remote' };
          });
        }),
      };
    }),
  );
}
