import {
  AuthorizeWaysInService,
  CloseTunnelConnectionsService,
  OpenRemoteRoutesService,
  ReadEnvironmentService,
  SetRemoteAccessService,
} from '@porcelain/access/services';
import { protectedRoute } from '@porcelain/access/rules';
import {
  type SetRemoteAccessInput,
  type SetRemoteAccessResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { Logger } from '../../ports/logger.ts';
import { Context, Effect, Layer, Cause } from 'effect';
import {
  type RemoteRouteInUseError,
  type InvalidTailnetHostnameError,
  type InvalidTunnelHostnameError,
  type MissingTailnetHostnameError,
  type MissingTunnelHostnameError,
  type NoLocalNetworkError,
  type UnidentifiedLocalNetworkError,
  type WaysInChangedError,
  type WaysInPermissionRequiredError,
} from '@porcelain/access/errors';

type SetRemoteAccessFailure =
  | WaysInPermissionRequiredError
  | WaysInChangedError
  | RemoteRouteInUseError
  | InvalidTailnetHostnameError
  | InvalidTunnelHostnameError
  | MissingTailnetHostnameError
  | MissingTunnelHostnameError
  | NoLocalNetworkError
  | UnidentifiedLocalNetworkError;

export class SetRemoteAccessUseCase extends Context.Service<
  SetRemoteAccessUseCase,
  {
    readonly execute: (
      input: SetRemoteAccessInput,
    ) => Effect.Effect<SetRemoteAccessResponse, SetRemoteAccessFailure>;
  }
>()('@porcelain/server/SetRemoteAccessUseCase') {
  static readonly layer = Layer.effect(
    SetRemoteAccessUseCase,
    Effect.gen(function* () {
      const authorizeWaysInCapability = yield* AuthorizeWaysInService;
      const setRemoteAccessCapability = yield* SetRemoteAccessService;
      const openRemoteRoutesCapability = yield* OpenRemoteRoutesService;
      const closeTunnelConnectionsCapability =
        yield* CloseTunnelConnectionsService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const loggerCapability = yield* Logger;

      return {
        execute: Effect.fn('SetRemoteAccessUseCase.execute')(function* (
          input: SetRemoteAccessInput,
        ): Effect.fn.Return<SetRemoteAccessResponse, SetRemoteAccessFailure> {
          const ingress = protectedRoute(input);
          yield* lanesCapability.run(laneKeysCapability.access(), 'read', () =>
            authorizeWaysInCapability.execute(input),
          );
          const saved = yield* lanesCapability.commit(
            laneKeysCapability.remoteAccess(),
            () =>
              Effect.gen(function* () {
                const changed = yield* setRemoteAccessCapability.execute({
                  expected: input.expected,
                  change: input.change,
                  caller: input,
                });
                if (changed.applied)
                  yield* closeTunnelConnectionsCapability.execute();
                return changed;
              }),
            (changed) =>
              changed.applied
                ? lanesCapability.background(
                    laneKeysCapability.remoteAccess(),
                    () =>
                      Effect.gen(function* () {
                        yield* openRemoteRoutesCapability.execute(
                          yield* readEnvironmentCapability.execute(),
                        );
                        yield* closeTunnelConnectionsCapability.execute();
                      }),
                    (cause) =>
                      Cause.hasInterruptsOnly(cause)
                        ? Effect.void
                        : Effect.sync(() =>
                            loggerCapability.failure({
                              kind: 'job',
                              job: 'open-remote-routes',
                              error: Cause.squash(cause),
                            }),
                          ),
                  )
                : Effect.void,
          );
          return {
            ...saved.remote,
            editing: {
              fingerprint: saved.fingerprint,
              ...(ingress === undefined ? {} : { protectedRoute: ingress }),
            },
          };
        }),
      };
    }),
  );
}
