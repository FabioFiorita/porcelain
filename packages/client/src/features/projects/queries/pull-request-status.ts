import { Clock, Effect, Option, Queue, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { ReadPullStatusResponse } from '@porcelain/contracts/projects';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { readProjectPullStatus } from './pull-requests.ts';
import type { PageActivity } from '../ports/page-activity.ts';
import { requestedReruns } from '../store/pull-request-reruns.ts';
import {
  nextPollDelay,
  pullStatusView,
  rerunsStillPending,
  statusFingerprint,
  statusIsMoving,
  type PullStatus,
} from '../rules/pull-request-checks.ts';

export type PullStatusWatch = {
  readonly status: PullStatus | undefined;
  readonly problem:
    | Extract<ReadPullStatusResponse, { kind: 'unavailable' }>['reason']
    | 'failed'
    | undefined;
  readonly pending: readonly string[];
  readonly readAt: number;
};

const untilActive = (activity: PageActivity | undefined) =>
  Effect.callback<void>((resume) => {
    if (activity === undefined || activity.isActive()) {
      resume(Effect.void);
      return;
    }
    const stop = activity.subscribe(() => {
      if (!activity.isActive()) return;
      stop();
      resume(Effect.void);
    });
    return Effect.sync(stop);
  });

const activitySignal = (activity: PageActivity | undefined) =>
  Atom.readable((get) => {
    if (activity === undefined) return 0;
    let count = 0;
    get.addFinalizer(
      activity.subscribe(() => {
        if (activity.isActive()) get.setSelf(++count);
      }),
    );
    return count;
  });

export const watchProjectPullStatus = Atom.family(
  (input: {
    connection: RuntimeConnection;
    projectId: string;
    number: number;
    activity?: PageActivity | undefined;
  }) =>
    clientRuntime(input.connection)
      .atom((get) => {
        const reruns = get(
          requestedReruns({
            environmentId: input.connection.environmentId,
            projectId: input.projectId,
            number: input.number,
          }),
        );
        const query = readProjectPullStatus({
          connection: input.connection,
          projectId: input.projectId,
          number: input.number,
        });
        const read = Effect.suspend(() => {
          if (get.registry.getNodes().has(query) && !get.once(query).waiting)
            get.refresh(query);
          return get.resultOnce(query, { suspendOnWaiting: true });
        });
        return Stream.callback((queue: Queue.Queue<PullStatusWatch, unknown>) =>
          Effect.gen(function* () {
            let delay: number | undefined;
            let seen: string | undefined;
            let status = Option.getOrUndefined(
              get.self<PullStatusWatch>(),
            )?.status;
            while (true) {
              yield* untilActive(input.activity);
              const answer = yield* Effect.exit(read);
              if (answer._tag === 'Failure' && status === undefined)
                return yield* Queue.failCause(queue, answer.cause);
              let problem: PullStatusWatch['problem'] = 'failed';
              if (answer._tag === 'Success') {
                const value = answer.value;
                if (value.kind === 'available') {
                  status = value.status;
                  problem = undefined;
                } else problem = value.reason;
              }
              const now = yield* Clock.currentTimeMillis;
              const pending = status
                ? rerunsStillPending(status, reruns, now)
                : [];
              Queue.offerUnsafe(queue, {
                status,
                problem,
                pending: pending.map((entry) => entry.key),
                readAt: now,
              });
              if (
                status === undefined ||
                (!statusIsMoving(status) && pending.length === 0)
              )
                return;
              const fingerprint = statusFingerprint(status);
              delay = nextPollDelay(delay, fingerprint !== seen);
              seen = fingerprint;
              yield* Effect.sleep(delay);
            }
          }),
        );
      })
      .pipe(
        input.connection.atoms.withReactivity([
          queryKeys.projectPullRequests(
            input.connection.environmentId,
            input.projectId,
          ),
        ]),
        Atom.makeRefreshOnSignal(activitySignal(input.activity)),
        Atom.setIdleTTL(0),
      ),
);

export const watchPullStatusView = Atom.family(
  (input: Parameters<typeof watchProjectPullStatus>[0]) =>
    Atom.make((get) => {
      const result = get(watchProjectPullStatus(input));
      return pullStatusView({
        watch: Option.getOrUndefined(AsyncResult.value(result)),
        failed: AsyncResult.isFailure(result),
        waiting: result.waiting,
        requested: get(
          requestedReruns({
            environmentId: input.connection.environmentId,
            projectId: input.projectId,
            number: input.number,
          }),
        ),
      });
    }).pipe(Atom.setIdleTTL(0)),
);
