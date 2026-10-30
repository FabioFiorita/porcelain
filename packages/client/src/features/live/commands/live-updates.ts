import { liveSessionState } from '../store.ts';
import {
  Cause,
  Clock,
  Context,
  Deferred,
  Effect,
  Queue,
  Ref,
  Exit,
  Schedule,
  Semaphore,
  Stream,
  type Scope,
} from 'effect';
import { RpcClient, RpcClientError, RpcSerialization } from 'effect/rpc';
import { Socket } from 'effect/socket';
import { LiveUpdatesRpc } from '@porcelain/contracts/access';
import { RequestError } from '../../../shared/api/request-error.ts';
import type { StatusActivity } from '../../access/ports/status-activity.ts';
import type { LiveSubscription, LiveUpdatePort } from '../ports/live-update.ts';
import {
  LIVE_ACCESS_REVOKED_CLOSE_CODE,
  LIVE_CONNECT_TIMEOUT_MS,
  LIVE_PROBE_TIMEOUT_MS,
  LIVE_RESUME_REFRESH_MS,
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
  options?: {
    readonly activity?: StatusActivity;
    readonly recoverUnauthorized?: () => Effect.Effect<boolean>;
  },
): LiveUpdatePort {
  const state = liveSessionState();
  return {
    state,
    connect: Effect.fn('LiveUpdates.connect')(function* ({
      onNotice,
      onReconnect,
      onUnauthorized,
    }) {
      const desired = yield* Ref.make<LiveSubscription>({
        projects: [],
        worktrees: [],
      });
      const clock = yield* Clock.Clock;
      const wakeups = yield* Queue.sliding<void>(1);
      let refreshOnForeground = false;
      const foreground = Queue.take(wakeups);
      if (options?.activity) {
        const activity = options.activity;
        let wasActive = activity.isActive();
        let inactiveAt = clock.monotonicTimeNanosUnsafe();
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            activity.subscribe(() => {
              const active = activity.isActive();
              const now = clock.monotonicTimeNanosUnsafe();
              if (!active && wasActive) inactiveAt = now;
              if (active) {
                refreshOnForeground ||=
                  !wasActive &&
                  now - inactiveAt >=
                    BigInt(LIVE_RESUME_REFRESH_MS) * 1_000_000n;
                Queue.offerUnsafe(wakeups, undefined);
              }
              wasActive = active;
            }),
          ),
          (unsubscribe) => Effect.sync(unsubscribe),
        );
      }
      const updates = yield* Queue.sliding<void>(LIVE_SUBSCRIPTION_BUFFER);
      let readyCount = 0;
      let retryMs = LIVE_RECONNECT_FIRST_MS;
      const connection = Effect.scoped(
        Effect.gen(function* () {
          state.set(readyCount === 0 ? 'connecting' : 'reconnecting');
          const socket = yield* open;
          const ready = yield* Deferred.make<void>();
          const announced = yield* Deferred.make<void>();
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
          const gate = yield* Semaphore.make(1);
          const follow = gate.withPermit(
            Effect.flatMap(Ref.get(desired), (value) => client.follow(value)),
          );
          const receive = client.notices(undefined).pipe(
            Stream.runForEach((notice) =>
              Effect.gen(function* () {
                if (notice.type === 'ready') {
                  yield* Deferred.succeed(announced, undefined);
                  return;
                }
                onNotice(notice);
              }),
            ),
          );
          const establish = Effect.gen(function* () {
            yield* Deferred.await(announced);
            yield* follow;
            if (readyCount > 0) onReconnect();
            readyCount += 1;
            retryMs = LIVE_RECONNECT_FIRST_MS;
            state.set('connected');
            yield* Deferred.succeed(ready, undefined);
            onNotice({ type: 'ready' });
          }).pipe(
            Effect.timeout(LIVE_CONNECT_TIMEOUT_MS),
            Effect.andThen(Effect.never),
          );
          const send = Deferred.await(ready).pipe(
            Effect.andThen(
              Effect.forever(Queue.take(updates).pipe(Effect.andThen(follow))),
            ),
          );

          const monitor = Effect.forever(
            Effect.gen(function* () {
              yield* foreground;
              yield* Deferred.await(ready);
              const refresh = refreshOnForeground;
              refreshOnForeground = false;
              yield* follow.pipe(Effect.timeout(LIVE_PROBE_TIMEOUT_MS));
              if (refresh) {
                onReconnect();
                onNotice({ type: 'ready' });
              }
            }),
          );
          yield* Effect.all([receive, send, monitor, establish], {
            concurrency: 'unbounded',
          }).pipe(Effect.raceFirst(Deferred.await(disconnected)));
        }),
      );
      const session = Effect.scoped(
        Effect.gen(function* () {
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => state.set('idle')).pipe(
              Effect.andThen(Queue.shutdown(updates)),
              Effect.andThen(Queue.shutdown(wakeups)),
            ),
          );
          while (true) {
            const result = yield* Effect.exit(connection);
            if (
              Exit.isFailure(result) &&
              unauthorized(Cause.squash(result.cause))
            ) {
              if (
                !(yield* (
                  options?.recoverUnauthorized?.() ?? Effect.succeed(false)
                ))
              ) {
                state.set('unauthorized');
                onUnauthorized();
                return yield* Effect.never;
              }
            }
            state.set(readyCount === 0 ? 'connecting' : 'reconnecting');
            yield* Effect.sleep(retryMs).pipe(Effect.raceFirst(foreground));
            retryMs = Math.min(
              retryMs * LIVE_RECONNECT_BACKOFF,
              LIVE_RECONNECT_MAX_MS,
            );
          }
        }),
      );
      yield* Effect.yieldNow.pipe(
        Effect.andThen(session),
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
          Queue.offerUnsafe(updates, undefined);
        },
      };
    }),
  };
}
