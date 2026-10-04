import { useQueryClient } from '@tanstack/react-query';
import { recoverChangedDiffs } from '@porcelain/client/changes';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useRecoverChangedDiffs(
  scope: ChangesScope,
  connection: Connection,
) {
  const client = useQueryClient();
  return (statusToken: string) => {
    void recoverChangedDiffs(scope, connection, client, statusToken);
  };
}
