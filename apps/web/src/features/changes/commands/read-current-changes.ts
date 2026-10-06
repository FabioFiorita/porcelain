import { useAtomSet } from '@effect/atom-react';
import { readCurrentChanges, refreshGitLook } from '@porcelain/client/changes';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useReadCurrentChanges(
  scope: ChangesScope,
  connection: Connection,
) {
  return useAtomSet(readCurrentChanges({ connection, scope }), {
    mode: 'promise',
  });
}

export function useRefreshGitLook(scope: ChangesScope, connection: Connection) {
  return useAtomSet(refreshGitLook({ connection, scope }), { mode: 'promise' });
}
