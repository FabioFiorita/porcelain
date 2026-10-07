import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { Context, Effect, Layer, Option } from 'effect';
import { Atom } from 'effect/reactivity';
import { type WriteNotSentError } from '../../../shared/api/write-queue.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import type { ConnectionError } from '../../../shared/api/connection-error.ts';
import type { RequestError } from '../../../shared/api/request-error.ts';
import {
  porcelainClient,
  type PorcelainApi,
} from '../../../shared/api/client.ts';
import {
  confirmedResource,
  type ConfirmedResource,
} from '../../../shared/api/confirmed-resource.ts';

type InventoryFailure =
  | Effect.Error<ReturnType<PorcelainApi['projects']['readInventory']>>
  | ConnectionError
  | RequestError;

export const InventorySeed = Context.Reference(
  '@porcelain/client/InventorySeed',
  {
    defaultValue: () => Option.none<ReadInventoryResponse>(),
  },
);
export class InventoryState extends Context.Service<
  InventoryState,
  {
    readonly stream: ConfirmedResource<
      ReadInventoryResponse,
      InventoryFailure
    >['stream'];
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
        const client = yield* porcelainClient(connection);
        const resource = yield* confirmedResource(
          connection,
          queryKeys.inventory(connection.environmentId),
          client
            .request((api) => api.projects.readInventory())
            .pipe(
              Effect.tap((inventory) =>
                currentAnswerEffect(
                  connection,
                  inventory.environmentId === connection.environmentId,
                ),
              ),
            ),
          seed,
        );
        function confirm<A, E, R>(
          operation: Effect.Effect<A, E, R>,
          change: (
            inventory: ReadInventoryResponse,
            answer: A,
          ) => ReadInventoryResponse,
        ) {
          return resource.confirm(operation, (previous, answer) =>
            Option.map(previous, (inventory) => change(inventory, answer)),
          );
        }
        return { stream: resource.stream, confirm };
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
