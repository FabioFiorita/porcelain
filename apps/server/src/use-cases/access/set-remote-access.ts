import {
  CloseTunnelConnectionsService,
  OpenRemoteRoutesService,
  ReadEnvironmentService,
  SetRemoteAccessService,
} from '@porcelain/access/services';
import {
  type SetRemoteAccessRequest,
  type SetRemoteAccessResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { Logger } from '../../ports/logger.ts';
import { Context, Effect, Layer, Cause } from 'effect';
import {
  type InvalidTailnetHostnameError,
  type InvalidTunnelHostnameError,
  type MissingTailnetHostnameError,
  type MissingTunnelHostnameError,
  type NoLocalNetworkError,
  type UnidentifiedLocalNetworkError,
} from '@porcelain/access/errors';

export class SetRemoteAccessUseCase extends Context.Service<
  SetRemoteAccessUseCase,
  {
    readonly execute: (
      input: SetRemoteAccessRequest,
    ) => Effect.Effect<
      SetRemoteAccessResponse,
      | InvalidTailnetHostnameError
      | InvalidTunnelHostnameError
      | MissingTailnetHostnameError
      | MissingTunnelHostnameError
      | NoLocalNetworkError
      | UnidentifiedLocalNetworkError
    >;
  }
>()('@porcelain/server/SetRemoteAccessUseCase') {
  static readonly layer = Layer.effect(
    SetRemoteAccessUseCase,
    Effect.gen(function* () {
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
          input: SetRemoteAccessRequest,
        ): Effect.fn.Return<
          SetRemoteAccessResponse,
          | InvalidTailnetHostnameError
          | InvalidTunnelHostnameError
          | MissingTailnetHostnameError
          | MissingTunnelHostnameError
          | NoLocalNetworkError
          | UnidentifiedLocalNetworkError
        > {
          return yield* lanesCapability.commit(
            laneKeysCapability.remoteAccess(),
            () =>
              Effect.uninterruptible(
                Effect.gen(function* () {
                  const changed =
                    yield* setRemoteAccessCapability.execute(input);
                  yield* closeTunnelConnectionsCapability.execute();
                  return changed;
                }),
              ),
            () =>
              lanesCapability.background(
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
              ),
          );
        }),
      };
    }),
  );
}
