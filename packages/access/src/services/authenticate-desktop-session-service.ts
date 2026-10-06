import { DesktopSession } from '../ports/desktop-session.ts';
import { Redacted, Effect, Context, Layer } from 'effect';
import type {
  AuthenticateDeviceInput,
  AuthenticateDeviceResult,
} from '../models/authenticate-device.ts';

import { secretMatches } from '../rules/credential.ts';

export class AuthenticateDesktopSessionService extends Context.Service<
  AuthenticateDesktopSessionService,
  {
    readonly execute: (
      input: AuthenticateDeviceInput,
    ) => Effect.Effect<AuthenticateDeviceResult, never>;
  }
>()('@porcelain/access/AuthenticateDesktopSessionService') {
  static readonly layer = Layer.effect(
    AuthenticateDesktopSessionService,
    Effect.gen(function* () {
      const session = yield* DesktopSession;

      return {
        execute: Effect.fn('AuthenticateDesktopSessionService.execute')(
          function* (
            input: AuthenticateDeviceInput,
          ): Effect.fn.Return<AuthenticateDeviceResult, never> {
            return yield* Effect.sync<AuthenticateDeviceResult>(() => {
              if (
                session === undefined ||
                input.route !== 'loopback' ||
                !secretMatches(
                  session.secretHash,
                  Redacted.make(input.credential),
                )
              )
                return { kind: 'refused' };
              return { kind: 'authenticated', deviceId: session.deviceId };
            });
          },
        ),
      };
    }),
  );
}
