import { readChanges } from '@porcelain/client/changes';
import { useAtomSuspense, useAtomValue } from '@effect/atom-react';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useChanges(scope: ChangesScope, connection: Connection) {
  return useAtomSuspense(readChanges({ scope, connection })).value;
}

export function useReviewOverview(scope: ChangesScope, connection: Connection) {
  return useAtomValue(readChanges({ scope, connection }));
}
