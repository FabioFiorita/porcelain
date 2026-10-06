import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { Context, Effect, Layer, Option, SubscriptionRef } from 'effect';
import { AsyncResult, Atom, Reactivity } from 'effect/reactivity';
import {
  WriteQueues,
  type WriteNotSentError,
} from '../../../shared/api/write-queue.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import type { ConnectionError } from '../../../shared/api/connection-error.ts';
import type { RequestError } from '../../../shared/api/request-error.ts';
import type { porcelainClient } from '../../../shared/api/client.ts';

type InventoryFailure =
  | Effect.Error<
      ReturnType<
        Context.Service.Shape<
          ReturnType<typeof porcelainClient>
        >['projects']['readInventory']
      >
    >
  | ConnectionError
  | RequestError;

export const InventorySeed = Context.Reference(
  '@porcelain/client/InventorySeed',
  {
    defaultValue: () => Option.none<ReadInventoryResponse>(),
  },
);
type InventorySnapshot = {
  readonly epoch: number;
  readonly result: AsyncResult.AsyncResult<
    ReadInventoryResponse,
    InventoryFailure
  >;
};

export class InventoryState extends Context.Service<
  InventoryState,
  {
    readonly state: SubscriptionRef.SubscriptionRef<InventorySnapshot>;
    readonly confirm: <A, E, R>(
      operation: Effect.Effect<A, E, R>,
      change: (
        inventory: ReadInventoryResponse,
        answer: A,
      ) => ReadInventoryResponse,
    ) => Effect.Effect<A, E | ConnectionError | WriteNotSentError, R>;
  }
>()('@porcelain/client/InventoryState') {
  static layer(connection: RuntimeConnection) {
    return Layer.effect(
      InventoryState,
      Effect.gen(function* () {
        const seed = yield* InventorySeed;
        const queues = yield* WriteQueues;
        const reactivity = yield* Reactivity.Reactivity;
        const state = yield* SubscriptionRef.make<InventorySnapshot>({
          epoch: 0,
          result: Option.match(seed, {
            onNone: () =>
              AsyncResult.initial<ReadInventoryResponse, InventoryFailure>(),
            onSome: (value) =>
              AsyncResult.success<ReadInventoryResponse, InventoryFailure>(
                value,
              ),
          }),
        });
        function confirm<A, E, R>(
          operation: Effect.Effect<A, E, R>,
          change: (
            inventory: ReadInventoryResponse,
            answer: A,
          ) => ReadInventoryResponse,
        ) {
          return queues.run(
            queryKeys.connectedInventory(connection),
            Effect.gen(function* () {
              yield* currentAnswerEffect(connection.request().signal);
              yield* SubscriptionRef.update(state, (current) => ({
                ...current,
                epoch: current.epoch + 1,
              }));
              const answer = yield* operation;
              yield* currentAnswerEffect(connection.request().signal);
              yield* SubscriptionRef.update(state, (current) => ({
                epoch: current.epoch + 1,
                result: Option.match(AsyncResult.value(current.result), {
                  onNone: () => current.result,
                  onSome: (inventory) =>
                    AsyncResult.success(change(inventory, answer)),
                }),
              }));
              return answer;
            }).pipe(
              Effect.ensuring(
                reactivity.invalidate([
                  queryKeys.inventory(connection.environmentId),
                ]),
              ),
            ),
          );
        }
        return { state, confirm };
      }),
    );
  }
}

export const inventoryRuntime = Atom.family((connection: RuntimeConnection) =>
  connection.atoms((get) =>
    Layer.provideMerge(
      InventoryState.layer(connection),
      get(clientRuntime(connection).layer),
    ),
  ),
);
