import { Effect, Fiber } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { WriteQueues } from '../../../shared/api/write-queue.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import type { ReviewClock } from '../ports/review-clock.ts';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import type { QueryClient } from '@tanstack/query-core';
import type { ListReviewedFilesResponse } from '@porcelain/contracts/reviews';

type Queue = {
  confirmed: ListReviewedFilesResponse | undefined;
  pending: Intent[];
};
type QueueContext = {
  connection: WorktreeConnection;
  key: readonly unknown[];
  clock: ReviewClock;
};
type ReviewedChange = { path: string; fingerprint?: string };
type Intent = ReviewedChange & { reviewedAt: string };
const queues = new WeakMap<object, Map<string, Queue>>();

export function enqueueReviewed<A extends ListReviewedFilesResponse, E>(
  context: QueueContext,
  client: QueryClient,
  change: ReviewedChange,
  operation: Effect.Effect<A, E>,
) {
  return enqueueReviewedMany(context, client, [change], operation);
}

export function enqueueReviewedMany<A extends ListReviewedFilesResponse, E>(
  context: QueueContext,
  client: QueryClient,
  changes: readonly ReviewedChange[],
  operation: Effect.Effect<A, E>,
) {
  return Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const signal = context.connection.request().signal;
      yield* restore(currentAnswerEffect(signal));
      let entries = queues.get(context.connection);
      if (!entries) {
        entries = new Map();
        queues.set(context.connection, entries);
      }
      const hash = JSON.stringify(context.key);
      let queue = entries.get(hash);
      if (!queue) {
        queue = {
          confirmed: client.getQueryData(context.key),
          pending: [],
        };
        entries.set(hash, queue);
      }
      const current = queue;
      const intents: Intent[] = changes.map((change) => ({
        ...change,
        reviewedAt: context.clock.now(),
      }));
      current.pending.push(...intents);
      const publish = () => {
        if (signal.aborted || !current.confirmed) return;
        const marks = new Map(
          current.confirmed.marks.map((mark) => [mark.path, mark]),
        );
        for (const pending of current.pending) {
          if (pending.fingerprint)
            marks.set(pending.path, {
              path: pending.path,
              fingerprint: pending.fingerprint,
              reviewedAt: pending.reviewedAt,
            });
          else marks.delete(pending.path);
        }
        client.setQueryData(context.key, {
          ...current.confirmed,
          marks: [...marks.values()],
        });
      };
      const ready = yield* Effect.forkChild(
        nativeOperation(() =>
          client.cancelQueries({ queryKey: context.key, exact: true }),
        ).pipe(Effect.andThen(Effect.sync(publish))),
        { startImmediately: true },
      );
      const settled = Effect.gen(function* () {
        yield* Fiber.interrupt(ready);
        if (!signal.aborted)
          yield* nativeOperation(() =>
            client.cancelQueries({ queryKey: context.key, exact: true }),
          );
        current.pending = current.pending.filter(
          (pending) => !intents.includes(pending),
        );
        publish();
        if (current.pending.length === 0) entries.delete(hash);
      });
      let started = false;
      return yield* restore(
        WriteQueues.use((writes) =>
          writes.run(
            context.key,
            Effect.gen(function* () {
              started = true;
              yield* Fiber.join(ready);
              const response = yield* operation;
              yield* currentAnswerEffect(
                signal,
                !current.confirmed ||
                  response.worktreeId === current.confirmed.worktreeId,
              );
              current.confirmed = {
                worktreeId: response.worktreeId,
                marks: response.marks,
              };
              return response;
            }).pipe(Effect.ensuring(settled)),
          ),
        ).pipe(
          Effect.ensuring(
            Effect.suspend(() => (started ? Effect.void : settled)),
          ),
        ),
      );
    }),
  );
}
