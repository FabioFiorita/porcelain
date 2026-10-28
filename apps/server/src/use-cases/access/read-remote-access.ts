import { Context, Effect, Layer } from 'effect';
import { type WaysInPermissionRequiredError } from '@porcelain/access/errors';
import { protectedRoute } from '@porcelain/access/rules';
import {
  AuthorizeWaysInService,
  ReadRemoteAccessService,
} from '@porcelain/access/services';
import {
  type ReadRemoteAccessRequest,
  type ReadRemoteAccessResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ReadRemoteAccessUseCase extends Context.Service<
  ReadRemoteAccessUseCase,
  {
    readonly execute: (
      input: ReadRemoteAccessRequest,
    ) => Effect.Effect<ReadRemoteAccessResponse, WaysInPermissionRequiredError>;
  }
>()('@porcelain/server/ReadRemoteAccessUseCase') {
  static readonly layer = Layer.effect(
    ReadRemoteAccessUseCase,
    Effect.gen(function* () {
      const authorizeWaysInCapability = yield* AuthorizeWaysInService;
      const readRemoteAccessCapability = yield* ReadRemoteAccessService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ReadRemoteAccessUseCase.execute')(function* (
          input: ReadRemoteAccessRequest,
        ): Effect.fn.Return<
          ReadRemoteAccessResponse,
          WaysInPermissionRequiredError
        > {
          yield* lanesCapability.run(laneKeysCapability.access(), 'read', () =>
            authorizeWaysInCapability.execute(input),
          );
          return yield* lanesCapability.run(
            laneKeysCapability.remoteAccess(),
            'read',
            () =>
              Effect.gen(function* () {
                const { remote, fingerprint } =
                  yield* readRemoteAccessCapability.execute();
                return {
                  ...remote,
                  editing: {
                    fingerprint,
                    protectedRoute: protectedRoute(input),
                  },
                };
              }),
          );
        }),
      };
    }),
  );
}
