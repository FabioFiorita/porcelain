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
  settling: (answer: A | undefined) => boolean,
) {
  return Atom.optimistic(
    runtime
      .atom(
        Stream.fromEffect(read).pipe(
          Stream.repeat(Schedule.spaced(interval)),
          Stream.takeUntil(
            (answer) =>
              !settling(Option.getOrUndefined(AsyncResult.value(answer))),
          ),
        ),
      )
      .pipe(
        Atom.map((result) => AsyncResult.flatMap(result, (answer) => answer)),
      ),
  ).pipe(Atom.setIdleTTL(0));
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
export const readPairedAccess = Atom.family((connection: RuntimeConnection) =>
  clientRuntime(connection)
    .atom(requestApi(connection, (api) => api.administration.listAccess()))
    .pipe(Atom.setIdleTTL(0)),
);
export const readRemoteAccess = Atom.family((connection: RuntimeConnection) =>
  pollWhile(
    accessRuntime(connection),
    accessObservation(
      connection,
      (snapshots) => snapshots.remote,
      requestApi(connection, (api) =>
        api.administration.readRemoteAccess(),
      ).pipe(
        Effect.catch((error) =>
          error instanceof RequestError && error.status === 403
            ? Effect.succeed(null)
            : Effect.fail(error),
        ),
      ),
    ),
    REMOTE_ACCESS_SETTLING_POLL_MS,
    routesSettling,
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
    (answer) => answer?.running === true,
  ),
);
