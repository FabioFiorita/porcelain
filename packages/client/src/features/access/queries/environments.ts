import type { EnvironmentConnection } from '../ports/connection-factory.ts';
import { Effect, Layer, Option, Queue, Schedule, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import {
  REMOTE_STATUS_REFRESH_MS,
  REMOTE_ROUTE_TIMEOUT_MS,
  REMOTE_STATUS_TIMEOUT_MS,
} from '../../../config/limits.ts';
import { mapRequestErrors } from '../../../shared/api/effect-client.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import {
  remoteTransport,
  type Transport,
} from '../../../shared/api/transport.ts';
import type { AccessPlatformValue } from '../ports/access-platform.ts';
import {
  connectionRoutes,
  remoteStatus,
  sameRemoteConnection,
  type Remote,
  type ConnectionRoute,
  type RemoteAnswer,
  type RemoteStatus,
} from '../rules/remotes.ts';
import { statusChanges, statusRuntime } from '../store/status.ts';
import { BootstrapClient } from '../../../shared/api/bootstrap-client.ts';

export function remoteStatusResult<E>(
  remote: Pick<Remote, 'environmentId'>,
  result: AsyncResult.AsyncResult<RemoteAnswer, E>,
): RemoteStatus {
  return AsyncResult.isFailure(result)
    ? { kind: 'offline' }
    : remoteStatus(remote, Option.getOrUndefined(AsyncResult.value(result)));
}

export function readRemoteEnvironment(
  transport: Transport,
  environmentId: string,
): Effect.Effect<RemoteAnswer> {
  return Effect.gen(function* () {
    const api = yield* BootstrapClient;
    const environment = yield* mapRequestErrors(
      api.publicAccess.readEnvironment(),
    ).pipe(
      Effect.catchTag('ConnectionError', (error) =>
        mapRequestErrors(api.session.readSession()).pipe(
          Effect.andThen(Effect.fail(error)),
        ),
      ),
    );
    if (
      environment.environmentId === environmentId &&
      environment.protocol === ENVIRONMENT_PROTOCOL
    )
      yield* mapRequestErrors(api.session.readSession());
    return { kind: 'described' as const, environment };
  }).pipe(
    Effect.provide(BootstrapClient.layer(transport)),
    Effect.catch((error) =>
      Effect.succeed<RemoteAnswer>(
        error instanceof RequestError && error.status === 401
          ? { kind: 'unauthorized' }
          : { kind: 'unreachable' },
      ),
    ),
    Effect.timeoutOption(REMOTE_STATUS_TIMEOUT_MS),
    Effect.map((result) =>
      Option.getOrElse(result, (): RemoteAnswer => ({ kind: 'unreachable' })),
    ),
  );
}

export function revalidateRemoteStatus(
  platform: AccessPlatformValue,
  remote: Remote,
) {
  statusChanges(platform.send).set({ remote, revision: Symbol() });
}

export const readRemoteRoute = Effect.fn('Environments.readVerifiedRoute')(
  function* (
    route: ConnectionRoute,
    environmentId: string,
    send: AccessPlatformValue['send'],
  ) {
    const transport = remoteTransport(route.address, route.credential, send);
    return yield* Effect.gen(function* () {
      const api = yield* BootstrapClient;
      const health = yield* mapRequestErrors(api.publicAccess.readHealth());
      if (health.environmentId !== environmentId)
        return { kind: 'foreign' as const };
      return yield* readRemoteEnvironment(transport, environmentId);
    }).pipe(
      Effect.provide(BootstrapClient.layer(transport)),
      Effect.catch(() => Effect.succeed<RemoteAnswer>({ kind: 'unreachable' })),
    );
  },
);

const readRemoteRoutes = Effect.fn('Environments.readRoutes')(function* (
  platform: AccessPlatformValue,
  remote: Remote,
) {
  let failure: RemoteAnswer = { kind: 'unreachable' };
  for (const route of connectionRoutes(remote)) {
    const answer = yield* readRemoteRoute(
      route,
      remote.environmentId,
      platform.send,
    ).pipe(
      Effect.timeoutOption(REMOTE_ROUTE_TIMEOUT_MS),
      Effect.map((value) =>
        Option.getOrElse(value, (): RemoteAnswer => ({ kind: 'unreachable' })),
      ),
    );
    if (remoteStatus(remote, answer).kind === 'online') return answer;
    if (answer.kind !== 'unreachable') failure = answer;
  }
  return failure;
});

const statusAtoms = Atom.family(
  ({ platform, remote }: { platform: AccessPlatformValue; remote: Remote }) => {
    const { send, statusActivity } = platform;
    return statusRuntime(platform)(Layer.empty)
      .atom(() => {
        let pending = false;
        let wasActive = false;
        let previous: RemoteAnswer | undefined;
        const activity = Stream.callback<boolean>(
          (events) =>
            Effect.gen(function* () {
              const changed = () => {
                const active = statusActivity?.isActive() ?? true;
                const resumed = active && !wasActive;
                wasActive = active;
                if (!active || resumed || !pending)
                  Queue.offerUnsafe(events, active);
              };
              yield* Effect.acquireRelease(
                Effect.sync(() => {
                  const unsubscribeActivity =
                    statusActivity?.subscribe(changed);
                  const unsubscribeChanges = statusChanges(send).subscribe(
                    () => {
                      const change = statusChanges(send).value;
                      if (change && sameRemoteConnection(change.remote, remote))
                        changed();
                    },
                  );
                  return () => {
                    unsubscribeActivity?.();
                    unsubscribeChanges?.();
                  };
                }),
                (unsubscribe) => Effect.sync(unsubscribe),
              );
              changed();
            }),
          { bufferSize: 1, strategy: 'sliding' },
        );
        const probe = Effect.gen(function* () {
          pending = true;
          const answer = yield* readRemoteRoutes(platform, remote);
          previous = answer;
          return answer;
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              pending = false;
            }),
          ),
        );
        return activity.pipe(
          Stream.switchMap((active) =>
            active
              ? Stream.suspend(() =>
                  previous?.kind === 'unreachable'
                    ? Stream.concat(
                        Stream.make({ kind: 'reconnecting' } as const),
                        Stream.fromEffect(probe),
                      )
                    : Stream.fromEffect(probe),
                ).pipe(Stream.repeat(Schedule.spaced(REMOTE_STATUS_REFRESH_MS)))
              : Stream.never,
          ),
        );
      })
      .pipe(Atom.setIdleTTL(0));
  },
);

export function readRemoteStatus(
  platform: AccessPlatformValue,
  remote: Remote,
) {
  return statusAtoms({ platform, remote });
}

const connectionStatusAtoms = Atom.family(
  ({
    platform,
    remote,
    connection,
  }: {
    platform: AccessPlatformValue;
    remote: Remote;
    connection: Pick<EnvironmentConnection, 'liveUpdates'> | undefined;
  }) =>
    Atom.readable((get): RemoteStatus => {
      const state = connection?.liveUpdates.state;
      if (state) get.addFinalizer(state.subscribe(() => get.refreshSelf()));
      const status = remoteStatusResult(
        remote,
        get(readRemoteStatus(platform, remote)),
      );
      if (state?.value === 'connected')
        return status.kind === 'online'
          ? status
          : { kind: 'online', name: remote.name };
      if (state?.value === 'unauthorized') return { kind: 'needs-pairing' };
      if (status.kind === 'other-server' || status.kind === 'incompatible')
        return status;
      if (state?.value === 'reconnecting') return { kind: 'reconnecting' };
      if (state?.value === 'connecting')
        return status.kind === 'offline' ? status : { kind: 'checking' };
      return status;
    }),
);

export function readRemoteConnectionStatus(
  platform: AccessPlatformValue,
  remote: Remote,
  connection: Pick<EnvironmentConnection, 'liveUpdates'> | undefined,
) {
  return connectionStatusAtoms({ platform, remote, connection });
}
