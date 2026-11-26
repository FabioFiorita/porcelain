import type { LiveDiagnostic } from '../rules/diagnostics.ts';
import { liveRetrySignal, liveSessionState } from '../store.ts';
import {
  Cause,
  Clock,
  Context,
  Data,
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

function socketReason(error: unknown) {
  return error instanceof RpcClientError.RpcClientError ||
    Socket.isSocketError(error)
    ? error.reason
    : undefined;
}

function unauthorized(error: unknown) {
  if (error instanceof RequestError) return error.status === 401;
  const reason = socketReason(error);
  return (
    reason?._tag === 'SocketCloseError' &&
    reason.code === LIVE_ACCESS_REVOKED_CLOSE_CODE
  );
}

class RetryRequested extends Data.TaggedError('RetryRequested') {}

type TimeoutEvent =
  | 'Connection setup timeout'
  | 'Ready timeout'
  | 'Follow timeout';

function disconnectDiagnostic(
  error: unknown,
  deadline: TimeoutEvent,
  silent: boolean,
): Omit<LiveDiagnostic, 'at'> {
  if (error instanceof RetryRequested) return { event: 'Retry requested' };
  if (Cause.isTimeoutError(error)) return { event: deadline };
  const reason = socketReason(error);
  if (reason?._tag === 'SocketCloseError') {
    const { code, closeReason } = reason;
    return {
      event: 'Socket closed',
      code,
      ...(closeReason
        ? {
            reason:
              code === LIVE_ACCESS_REVOKED_CLOSE_CODE &&
              closeReason === 'Device access revoked'
                ? 'Device access revoked'
                : 'Reason withheld',
          }
        : {}),
    };
  }
  if (silent) return { event: 'Liveness timeout' };
  if (reason?._tag === 'SocketOpenError' && reason.kind === 'Timeout')
    return { event: 'Connection setup timeout' };
  if (reason) return { event: 'Socket error' };
  return {
    event: unauthorized(error) ? 'Access refused' : 'Connection setup failed',
  };
}

const activityEvents = {
  suspend: 'Suspended',
  resume: 'Resumed',
} as const;

export function createLiveUpdates<E>(
  open: Effect.Effect<Socket.Socket, E, Scope.Scope>,
  context: Context.Context<never> = Context.empty(),
  options?: {
    readonly activity?: StatusActivity;
    readonly diagnostic?: (event: LiveDiagnostic) => void;
    readonly recoverUnauthorized?: () => Effect.Effect<boolean>;
  },
): LiveUpdatePort {
  const state = liveSessionState();
  const retry = liveRetrySignal();
  return {
    state,
    retry: () => retry.update((revision) => revision + 1),
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
      const record = (entry: Omit<LiveDiagnostic, 'at'>) =>
        options?.diagnostic?.({
          ...entry,
          at: clock.currentTimeMillisUnsafe(),
        });
      const refreshInPlace = () => {
        record({ event: 'Refreshed in place' });
        onReconnect();
      };
      const wakeups = yield* Queue.sliding<void>(1);
      let refreshOnForeground = false;
      const foreground = Queue.take(wakeups);
      const retries = yield* Queue.sliding<void>(1);
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          retry.subscribe(() => Queue.offerUnsafe(retries, undefined)),
        ),
        (unsubscribe) => Effect.sync(unsubscribe),
      );
      if (options?.activity) {
        const activity = options.activity;
        let wasActive = activity.isActive();
        let suspended = false;
        let inactiveAt = clock.monotonicTimeNanosUnsafe();
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            activity.subscribe((event) => {
              if (event) record({ event: activityEvents[event] });
              if (event) suspended = event === 'suspend';
              const active = !suspended && activity.isActive();
              const now = clock.monotonicTimeNanosUnsafe();
              if (!active && wasActive) inactiveAt = now;
              refreshOnForeground ||= event === 'resume';
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
      let deadline: TimeoutEvent = 'Connection setup timeout';
      let silent = false;
      const connection = Effect.scoped(
        Effect.gen(function* () {
          if (state.value === 'idle') state.set('connecting');
          deadline = 'Connection setup timeout';
          silent = false;
          record({ event: 'Connection attempt' });
          const socket = yield* open;
          deadline = 'Ready timeout';
          const ready = yield* Deferred.make<void>();
          const announced = yield* Deferred.make<void>();
          const disconnected = yield* Deferred.make<
            never,
            Socket.SocketError
          >();
          const protocol = yield* RpcClient.makeProtocolSocket({
            onPingTimeout: Effect.sync(() => {
              silent = true;
            }),
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
            deadline = 'Follow timeout';
            record({ event: 'Server ready' });
            yield* follow;
            if (readyCount > 0) refreshInPlace();
            record({ event: 'Connected' });
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
                refreshInPlace();
                onNotice({ type: 'ready' });
              }
            }),
          );
          const restart = Effect.forever(
            Queue.take(retries).pipe(
              Effect.andThen(Deferred.isDone(ready)),
              Effect.flatMap((isReady) =>
                isReady
                  ? Effect.sync(() => Queue.offerUnsafe(wakeups, undefined))
                  : Effect.fail(new RetryRequested()),
              ),
            ),
          );
          yield* Effect.all([receive, send, monitor, establish, restart], {
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
              Effect.andThen(Queue.shutdown(retries)),
            ),
          );
          while (true) {
            const result = yield* Effect.exit(connection);
            const error = Exit.isFailure(result)
              ? Cause.squash(result.cause)
              : undefined;
            if (Exit.isFailure(result))
              record(disconnectDiagnostic(error, deadline, silent));
            if (unauthorized(error)) {
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
            state.set(readyCount === 0 ? 'unavailable' : 'reconnecting');
            if (error instanceof RetryRequested) continue;
            record({ event: 'Retry scheduled', retryMs });
            yield* Effect.sleep(retryMs).pipe(
              Effect.raceFirst(foreground),
              Effect.raceFirst(Queue.take(retries)),
            );
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
