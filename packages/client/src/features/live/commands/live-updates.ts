import {
  Cause,
  Context,
  Deferred,
  Effect,
  Queue,
  Ref,
  Exit,
  Schedule,
  Stream,
  type Scope,
} from 'effect';
import { RpcClient, RpcClientError, RpcSerialization } from 'effect/rpc';
import { Socket } from 'effect/socket';
import { LiveUpdatesRpc } from '@porcelain/contracts/access';
import { RequestError } from '../../../shared/api/request-error.ts';
import type { LiveSubscription, LiveUpdatePort } from '../ports/live-update.ts';
import {
  LIVE_ACCESS_REVOKED_CLOSE_CODE,
  LIVE_RECONNECT_BACKOFF,
  LIVE_RECONNECT_FIRST_MS,
  LIVE_RECONNECT_MAX_MS,
  LIVE_SUBSCRIPTION_BUFFER,
} from '../../../config/limits.ts';

function unauthorized(error: unknown) {
  if (error instanceof RequestError) return error.status === 401;
  if (
    error instanceof RpcClientError.RpcClientError ||
    Socket.isSocketError(error)
  )
    return (
      error.reason._tag === 'SocketCloseError' &&
      error.reason.code === LIVE_ACCESS_REVOKED_CLOSE_CODE
    );
  return false;
}

export function createLiveUpdates<E>(
  open: Effect.Effect<Socket.Socket, E, Scope.Scope>,
  context: Context.Context<never> = Context.empty(),
): LiveUpdatePort {
  return {
    connect: Effect.fn('LiveUpdates.connect')(function* ({
      onNotice,
      onReconnect,
      onUnauthorized,
    }) {
      const desired = yield* Ref.make<LiveSubscription>({
        projects: [],
        worktrees: [],
      });
      const updates = yield* Queue.sliding<LiveSubscription>(
        LIVE_SUBSCRIPTION_BUFFER,
      );
      let readyCount = 0;
      let retryMs = LIVE_RECONNECT_FIRST_MS;
      const connection = Effect.scoped(
        Effect.gen(function* () {
          const socket = yield* open;
          const disconnected = yield* Deferred.make<
            never,
            Socket.SocketError
          >();
          const protocol = yield* RpcClient.makeProtocolSocket({
            retryPolicy: Schedule.forever.pipe(
              Schedule.setInputType<Socket.SocketError>(),
              Schedule.tap(({ input }) => Deferred.fail(disconnected, input)),
              Schedule.upTo({ times: 0 }),
            ),
          }).pipe(
            Effect.provideService(Socket.Socket, socket),
            Effect.provideService(
              RpcSerialization.RpcSerialization,
              RpcSerialization.json,
            ),
          );
          const client = yield* RpcClient.make(LiveUpdatesRpc, {
            disableTracing: true,
          }).pipe(Effect.provideService(RpcClient.Protocol, protocol));
          const receive = client.notices(undefined).pipe(
            Stream.runForEach((notice) =>
              Effect.gen(function* () {
                if (notice.type === 'ready') {
                  if (readyCount > 0) onReconnect();
                  readyCount += 1;
                  retryMs = LIVE_RECONNECT_FIRST_MS;
                  yield* client.follow(yield* Ref.get(desired));
                }
                onNotice(notice);
              }),
            ),
          );
          const send = Effect.forever(
            Effect.flatMap(Queue.take(updates), (value) =>
              client.follow(value),
            ),
          );
          yield* Effect.all([receive, send], { concurrency: 'unbounded' }).pipe(
            Effect.raceFirst(Deferred.await(disconnected)),
          );
        }),
      );
      const session = Effect.scoped(
        Effect.gen(function* () {
          yield* Effect.addFinalizer(() => Queue.shutdown(updates));
          while (true) {
            const result = yield* Effect.exit(connection);
            if (
              Exit.isFailure(result) &&
              unauthorized(Cause.squash(result.cause))
            ) {
              onUnauthorized();
              return;
            }
            yield* Effect.sleep(retryMs);
            retryMs = Math.min(
              retryMs * LIVE_RECONNECT_BACKOFF,
              LIVE_RECONNECT_MAX_MS,
            );
          }
        }),
      );
      yield* session.pipe(
        Effect.provideContext(context),
        Effect.catchCause((cause) =>
          Cause.hasInterrupts(cause)
            ? Effect.void
            : Effect.logError('Live updates stopped unexpectedly'),
        ),
        Effect.forkScoped,
      );
      return {
        subscribe(value) {
          if (updates.state._tag === 'Done') return;
          Effect.runSync(Ref.set(desired, value));
          Queue.offerUnsafe(updates, value);
        },
      };
    }),
  };
}
