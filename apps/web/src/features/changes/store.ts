import { useStore } from 'zustand';
import { changesStore, changesRecoveryKey } from '@porcelain/client/changes';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useRecoveringChanges(
  scope: ChangesScope,
  connection: Connection,
  statusToken: string,
) {
  const key = changesRecoveryKey(scope, connection);
  return useStore(changesStore, (state) => state.pending[key] === statusToken);
}
