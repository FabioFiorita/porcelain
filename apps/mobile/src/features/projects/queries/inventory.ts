import { Option } from 'effect';
import {
  useAtomRef,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from '@effect/atom-react';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import {
  readInventory,
  readInventories,
  refreshInventories,
} from '@porcelain/client/projects';
import type { EnvironmentInventory } from '@porcelain/client/projects/rules';
import { liveQueries } from '@porcelain/client/live';
import { accessPlatform } from '../../../shared/adapters/access-platform';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { remoteConnectionState } from '../../../shared/application/store';
import { readRemoteStatus } from '@porcelain/client/access';
import { remoteStatus } from '@porcelain/client/access/rules';
import type { RemoteConnection } from '@porcelain/client/access';

const unavailable = Atom.make(AsyncResult.initial<ReadInventoryResponse>());

export function useInventory(connection: RuntimeConnection | undefined) {
  const atom = connection ? readInventory(connection) : unavailable;
  return { result: useAtomValue(atom), read: useAtomRefresh(atom) };
}

const allInventories = Atom.family((remotes: readonly RemoteConnection[]) => {
  const connections = remotes.map((entry) => entry.connection);
  const inventories = readInventories(connections);
  return Atom.readable(
    (get) => {
      for (const { remote, connection } of remotes) {
        get(liveQueries({ connection }));
        get(readRemoteStatus(accessPlatform, remote));
      }
      return get(inventories);
    },
    (refresh) => refresh(inventories),
  );
});

const inventoryRetries = Atom.family((remotes: readonly RemoteConnection[]) =>
  Atom.writable(
    () => undefined,
    (context, _input: void) => {
      const online = remotes.filter(({ remote }) => {
        const health = context.get(readRemoteStatus(accessPlatform, remote));
        return (
          !AsyncResult.isFailure(health) &&
          remoteStatus(remote, Option.getOrUndefined(AsyncResult.value(health)))
            .kind === 'online'
        );
      });
      context.set(
        refreshInventories(online.map((entry) => entry.connection)),
        undefined,
      );
    },
  ),
);

export function useInventories(
  environments: readonly { environmentId: string; name: string }[],
) {
  const remotes = useAtomRef(remoteConnectionState);
  const atom = allInventories(remotes);
  const retry = useAtomSet(inventoryRetries(remotes));
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
