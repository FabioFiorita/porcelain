import { useAtomRef, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import {
  readInventory,
  readInventories,
  refreshInventories,
  workspaceInventory,
} from '@porcelain/client/projects';
import type { EnvironmentInventory } from '@porcelain/client/projects/rules';
import { liveQueries } from '@porcelain/client/live';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { remoteConnectionState } from '../../../shared/application/store';
import type { RemoteConnection } from '@porcelain/client/access';

const unavailable = Atom.make(AsyncResult.initial<ReadInventoryResponse>());

export function useInventory(connection: RuntimeConnection | undefined) {
  const atom = connection ? readInventory(connection) : unavailable;
  const result = useAtomValue(atom);
  const refresh = refreshInventories(connection ? [connection] : []);
  const retry = useAtomSet(refresh);
  return {
    result,
    read: () => retry(undefined),
    state: workspaceInventory(result),
  };
}

const allInventories = Atom.family((remotes: readonly RemoteConnection[]) => {
  const connections = remotes.map((entry) => entry.connection);
  const inventories = readInventories(connections);
  return Atom.readable((get) => {
    for (const { connection } of remotes) get(liveQueries({ connection }));
    return get(inventories);
  });
});

export function useInventories(
  environments: readonly { environmentId: string; name: string }[],
) {
  const remotes = useAtomRef(remoteConnectionState);
  const atom = allInventories(remotes);
  const retry = useAtomSet(
    refreshInventories(remotes.map((entry) => entry.connection)),
  );
  const results = useAtomValue(atom);
  return {
    environments: environments.map(
      ({ environmentId, name }): EnvironmentInventory => {
        const result = results.find(
          (entry) => entry.connection.environmentId === environmentId,
        )?.result;
        return {
          environmentId,
          name,
          status:
            result === undefined || AsyncResult.isInitial(result)
              ? 'reading'
              : AsyncResult.isFailure(result)
                ? 'failed'
                : 'ready',
          inventory:
            result === undefined
              ? undefined
              : Option.getOrUndefined(AsyncResult.value(result)),
        };
      },
    ),
    read: () => retry(undefined),
  };
}
