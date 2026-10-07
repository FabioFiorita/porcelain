import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import {
  InventoryState,
  inventoryRuntime,
} from '../../projects/store/inventory.ts';

export const renameEnvironment = Atom.family((connection: RuntimeConnection) =>
  inventoryRuntime(connection).fn(
    (name: string | null) =>
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        const inventory = yield* InventoryState;
        return yield* inventory.confirm(
          requestEffect(
            api.environmentName.renameEnvironment({ payload: { name } }),
            connection.request,
          ),
          (current, environment) => ({ ...current, environment }),
        );
      }),
    { concurrent: true },
  ),
);
