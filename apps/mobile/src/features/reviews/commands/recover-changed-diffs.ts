import { useQueryClient } from '@tanstack/react-query';
import { recoverChangedDiffs } from '@porcelain/client/changes';
import type { WorktreeConnection } from '@porcelain/client/transport';

export function useRecoverChangedDiffs(
  scope: { projectId: string; worktreeId: string },
  connection: WorktreeConnection,
) {
  const client = useQueryClient();
  return (statusToken: string) => {
    void recoverChangedDiffs(scope, connection, client, statusToken);
  };
}
