import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { useAtomValue } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import { AsyncResult, Atom } from 'effect/reactivity';
import { Cause, Option } from 'effect';
import { readInventory } from '@porcelain/client/projects';
import { type Connection } from '@/shared/workspace/connection';

const unavailable = Atom.make(AsyncResult.initial<ReadInventoryResponse>());

export function useInventory(connection: Connection) {
  return useConfirmedRead(readInventory(connection)).value;
}

export function useRemoteInventory(connection: Connection, enabled: boolean) {
  const result = useAtomValue(
    enabled ? readInventory(connection) : unavailable,
  );
  return {
    inventory: Option.getOrUndefined(AsyncResult.value(result)),
    error: AsyncResult.isFailure(result)
      ? Cause.squash(result.cause)
      : undefined,
  };
}
