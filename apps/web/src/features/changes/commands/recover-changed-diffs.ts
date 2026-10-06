import { useAtomSet } from '@effect/atom-react';
import { readCurrentChanges } from '@porcelain/client/changes';
import { type ChangesScope } from '@porcelain/client/changes/rules';
import { changedDiffRecovery } from '../store';
import { Effect } from 'effect';
import { type Connection } from '@/shared/workspace/connection';

export function useRecoverChangedDiffs(
  scope: ChangesScope,
  possibleConnection: Connection,
) {
  const connection = possibleConnection;
  const read = useAtomSet(readCurrentChanges({ scope, connection }), {
    mode: 'promiseExit',
  });
  const key = JSON.stringify([
    connection.environmentId,
    scope.projectId,
    scope.worktreeId,
  ]);
  return (statusToken: string) => {
    if (!Effect.runSync(changedDiffRecovery.begin(key, statusToken))) return;
    void read().finally(() =>
      Effect.runSync(changedDiffRecovery.finish(key, statusToken)),
    );
  };
}
