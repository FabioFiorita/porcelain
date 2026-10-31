import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  EnvironmentIcon,
  RenameEnvironmentResponse,
} from '@porcelain/contracts/access';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import {
  porcelainClient,
  type PorcelainApi,
} from '../../../shared/api/client.ts';
import {
  InventoryState,
  inventoryRuntime,
} from '../../projects/store/inventory.ts';

function changeLabel<A, E>(
  request: (
    api: PorcelainApi['environmentLabel'],
    value: A,
  ) => Effect.Effect<RenameEnvironmentResponse, E>,
) {
  return Atom.family((connection: RuntimeConnection) =>
    inventoryRuntime(connection).fn(
      (value: A) =>
        Effect.gen(function* () {
          const client = yield* porcelainClient(connection);
          const inventory = yield* InventoryState;
          return yield* inventory.confirm(
            client.request((api) => request(api.environmentLabel, value)),
            (current, environment) => ({ ...current, environment }),
          );
        }),
      { concurrent: true },
    ),
  );
}

export const renameEnvironment = changeLabel((api, name: string | null) =>
  api.renameEnvironment({ payload: { name } }),
);

export const setEnvironmentIcon = changeLabel(
  (api, icon: EnvironmentIcon | null) =>
    api.setEnvironmentIcon({ payload: { icon } }),
);
