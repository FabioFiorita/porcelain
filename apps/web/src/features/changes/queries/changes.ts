import { readChanges } from '@porcelain/client/changes';
import { useAtomValue } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useChanges(scope: ChangesScope, connection: Connection) {
  return useConfirmedRead(readChanges({ scope, connection })).value;
}

export function useReviewOverview(scope: ChangesScope, connection: Connection) {
  return useAtomValue(readChanges({ scope, connection }));
}
