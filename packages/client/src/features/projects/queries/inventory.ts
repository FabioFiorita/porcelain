import { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { InventoryState, inventoryRuntime } from '../store/inventory.ts';

export const readInventory = Atom.family((connection: RuntimeConnection) =>
  inventoryRuntime(connection)
    .atom(
      Stream.unwrap(
        Effect.map(InventoryState, (inventory) => inventory.stream),
      ),
    )
    .pipe(
      Atom.map((result) => AsyncResult.flatMap(result, (answer) => answer)),
      Atom.setIdleTTL(0),
    ),
);
import { Effect, Stream } from 'effect';
