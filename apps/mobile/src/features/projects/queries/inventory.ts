import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { readInventory } from '@porcelain/client/projects';
import type { RuntimeConnection } from '@porcelain/client/transport';

const unavailable = Atom.make(AsyncResult.initial<ReadInventoryResponse>());

export function useInventory(connection: RuntimeConnection | undefined) {
  const atom = connection ? readInventory(connection) : unavailable;
  return { result: useAtomValue(atom), read: useAtomRefresh(atom) };
}
