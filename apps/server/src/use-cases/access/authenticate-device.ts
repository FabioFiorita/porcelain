import { Context, Effect, Layer } from 'effect';
import {
  type AuthenticateDeviceInput,
  type AuthenticatedDevice,
} from '@porcelain/access/models';
import {
  AuthenticateDeviceService,
  AuthenticateDesktopSessionService,
} from '@porcelain/access/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class AuthenticateDeviceUseCase extends Context.Service<
  AuthenticateDeviceUseCase,
  {
    readonly execute: (
      input: AuthenticateDeviceInput,
    ) => Effect.Effect<AuthenticatedDevice | undefined, never>;
  }
>()('@porcelain/server/AuthenticateDeviceUseCase') {
  static readonly layer = Layer.effect(
    AuthenticateDeviceUseCase,
    Effect.gen(function* () {
      const authenticateDeviceCapability = yield* AuthenticateDeviceService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const authenticateDesktopSessionCapability =
        yield* AuthenticateDesktopSessionService;

      return {
        execute: Effect.fn('AuthenticateDeviceUseCase.execute')(function* (
          input: AuthenticateDeviceInput,
        ): Effect.fn.Return<AuthenticatedDevice | undefined, never> {
          const desktop =
            yield* authenticateDesktopSessionCapability.execute(input);
          if (desktop.kind === 'authenticated')
            return { deviceId: desktop.deviceId };
          const result = yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                return yield* authenticateDeviceCapability.execute(input);
              }),
          );
          return result.kind === 'authenticated'
            ? { deviceId: result.deviceId }
            : undefined;
        }),
      };
    }),
  );
}
