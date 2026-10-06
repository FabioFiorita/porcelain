import { Cause, Effect, Exit, Option, Stream, SubscriptionRef } from 'effect';
import { AsyncResult, Atom, Reactivity } from 'effect/reactivity';
import { porcelainClient } from '../../../shared/api/client.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { InventoryState, inventoryRuntime } from '../store/inventory.ts';

export const readInventory = Atom.family((connection: RuntimeConnection) =>
  inventoryRuntime(connection)
    .atom(
      Stream.unwrap(
        Effect.gen(function* () {
          const api = yield* porcelainClient(connection);
          const { state } = yield* InventoryState;
          const read = Effect.gen(function* () {
            const epoch = (yield* SubscriptionRef.get(state)).epoch;
            yield* SubscriptionRef.update(state, (current) => ({
              ...current,
              result: AsyncResult.waiting(current.result),
            }));
            const answer = yield* Effect.exit(
              requestEffect(api.projects.readInventory()).pipe(
                Effect.tap((inventory) =>
                  currentAnswerEffect(
                    connection.request().signal,
                    inventory.environmentId === connection.environmentId,
                  ),
                ),
              ),
            );
            if (Exit.isFailure(answer) && Cause.hasInterrupts(answer.cause))
              return yield* Effect.interrupt;
            yield* SubscriptionRef.update(state, (current) =>
              current.epoch === epoch
                ? {
                    ...current,
                    result: AsyncResult.fromExitWithPrevious(
                      answer,
                      Option.some(current.result),
                    ),
                  }
                : current,
            );
          });
          return Stream.merge(
            SubscriptionRef.changes(state).pipe(
              Stream.map((current) => current.result),
            ),
            Reactivity.stream(read, [
              queryKeys.inventory(connection.environmentId),
            ]).pipe(Stream.drain),
          );
        }),
      ),
    )
    .pipe(
      Atom.map((result) => AsyncResult.flatMap(result, (answer) => answer)),
      Atom.setIdleTTL(0),
    ),
);
