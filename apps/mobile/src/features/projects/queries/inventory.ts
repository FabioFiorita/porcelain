import { useAtomRef, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { readInventory, readInventories } from '@porcelain/client/projects';
import { liveQueries } from '@porcelain/client/live';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { remoteConnectionState } from '../../../shared/application/store';
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
      for (const connection of connections) get(liveQueries({ connection }));
      return get(inventories);
    },
    (refresh) => refresh(inventories),
  );
});

export function useInventories() {
  const atom = allInventories(useAtomRef(remoteConnectionState));
  return { results: useAtomValue(atom), read: useAtomRefresh(atom) };
}
