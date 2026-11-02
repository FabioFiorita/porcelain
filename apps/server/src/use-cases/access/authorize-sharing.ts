import { Context, Effect, Layer } from 'effect';
import { AuthorizeSharingService } from '@porcelain/access/services';
import type { WaysInCaller } from '@porcelain/access/models';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class AuthorizeSharingUseCase extends Context.Service<
  AuthorizeSharingUseCase,
  {
    readonly execute: (input: WaysInCaller) => Effect.Effect<boolean>;
  }
>()('@porcelain/server/AuthorizeSharingUseCase') {
  static readonly layer = Layer.effect(
    AuthorizeSharingUseCase,
    Effect.gen(function* () {
      const authorize = yield* AuthorizeSharingService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('AuthorizeSharingUseCase.execute')(
          (input: WaysInCaller) =>
            lanes.run(keys.access(), 'read', () =>
              authorize.execute(input).pipe(Effect.isSuccess),
            ),
        ),
      };
    }),
  );
}
