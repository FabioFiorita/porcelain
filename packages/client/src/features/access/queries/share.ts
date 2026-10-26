import type { ReadServiceUpdateResponse } from '@porcelain/contracts/access';
import {
  type Context,
  Cause,
  Effect,
  Exit,
  Option,
  Ref,
  Schedule,
  Stream,
} from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import {
  REMOTE_ACCESS_SETTLING_POLL_MS,
  SERVICE_UPDATE_POLL_MS,
} from '../../../config/limits.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import { routesSettling } from '../rules/share.ts';
import { accessRuntime, AccessSnapshots } from '../store/share.ts';

export function serviceUpdateSnapshot<E>(
  result: AsyncResult.AsyncResult<ReadServiceUpdateResponse, E>,
) {
  return AsyncResult.isSuccess(result) ? result.value : undefined;
}

function observe<A, E, R>(
  connection: RuntimeConnection,
  snapshot: Ref.Ref<Option.Option<A>>,
  request: Effect.Effect<A, E, R>,
) {
  return Effect.gen(function* () {
    const answer = yield* Effect.exit(
      request.pipe(Effect.tap(() => currentAnswerEffect(connection))),
    );
    if (Exit.isFailure(answer) && Cause.hasInterrupts(answer.cause))
      return yield* Effect.interrupt;
    if (Exit.isSuccess(answer))
      yield* Ref.set(snapshot, Option.some(answer.value));
    return AsyncResult.fromExitWithPrevious(
      answer,
      Option.map(yield* Ref.get(snapshot), AsyncResult.success),
    );
  });
}
function pollWhile<A, E, R>(
  runtime: Atom.AtomRuntime<R>,
  read: Effect.Effect<AsyncResult.AsyncResult<A, E>, never, R>,
  interval: number,
  settling: Effect.Effect<(answer: A | undefined) => boolean, never, R>,
) {
  const observation = runtime
    .atom((get) => {
      const previous = Option.flatMap(
        get.self<AsyncResult.AsyncResult<AsyncResult.AsyncResult<A, E>>>(),
        AsyncResult.value,
      );
      return Stream.unwrap(
        Effect.map(settling, (inProgress) =>
          Stream.concat(
            Stream.succeed(AsyncResult.waitingFrom(previous)),
            Stream.fromEffect(read).pipe(
              Stream.repeat(Schedule.spaced(interval)),
              Stream.takeUntil(
                (answer) =>
                  !inProgress(Option.getOrUndefined(AsyncResult.value(answer))),
              ),
            ),
          ),
        ),
      );
    })
    .pipe(
      Atom.map((result) => AsyncResult.flatMap(result, (answer) => answer)),
    );
  return Atom.optimistic(observation).pipe(
    Atom.transform((get, optimistic) => {
      const result = get(optimistic);
      return get(observation).waiting
        ? AsyncResult.waitingFrom(Option.some(result))
        : result;
    }),
    Atom.setIdleTTL(0),
  );
}

function accessObservation<A, E, R>(
  connection: RuntimeConnection,
  select: (
    snapshots: Context.Service.Shape<typeof AccessSnapshots>,
  ) => Ref.Ref<Option.Option<A>>,
  request: Effect.Effect<A, E, R>,
) {
  return Effect.flatMap(AccessSnapshots, (snapshots) =>
    observe(connection, select(snapshots), request),
  );
}
function deniedAsNull<A, E, R>(request: Effect.Effect<A, E, R>) {
  return request.pipe(
    Effect.catch((error) =>
      error instanceof RequestError && error.status === 403
        ? Effect.succeed(null)
        : Effect.fail(error),
    ),
  );
}
export const readPairedAccess = Atom.family((connection: RuntimeConnection) =>
  clientRuntime(connection)
    .atom(
      deniedAsNull(
        requestApi(connection, (api) => api.administration.listAccess()),
      ),
    )
    .pipe(Atom.setIdleTTL(0)),
);
export const readRemoteAccess = Atom.family((connection: RuntimeConnection) =>
  pollWhile(
    accessRuntime(connection),
    accessObservation(
      connection,
      (snapshots) => snapshots.remote,
      deniedAsNull(
        requestApi(connection, (api) => api.remoteAccess.readRemoteAccess()),
      ),
    ),
    REMOTE_ACCESS_SETTLING_POLL_MS,
    Effect.succeed(routesSettling),
  ),
);
export const readServiceUpdate = Atom.family((connection: RuntimeConnection) =>
  pollWhile(
    accessRuntime(connection),
    accessObservation(
      connection,
      (snapshots) => snapshots.update,
      requestApi(connection, (api) => api.serviceUpdates.readServiceUpdate()),
    ),
    SERVICE_UPDATE_POLL_MS,
    Effect.gen(function* () {
      const snapshots = yield* AccessSnapshots;
      const previous = Option.getOrUndefined(yield* Ref.get(snapshots.update));
      let target = previous?.running ? previous.last?.target : undefined;
      return (answer: ReadServiceUpdateResponse | undefined) => {
        if (answer?.managed !== true) return false;
        if (answer.running) {
          target = answer.last?.target;
          return true;
        }
        return (
          target !== undefined &&
          answer.last?.stage === 'updated' &&
          answer.last.target === target &&
          answer.version === answer.last.from &&
          answer.version !== target
        );
      };
    }),
  ),
);
