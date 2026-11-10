import { readProjectPullRequest } from '@porcelain/client/projects';
import { useInventory } from '@/features/projects/index';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { Connection } from '@/shared/workspace/connection';
export function usePullRequestCheckout(
  connection: Connection,
  projectId: string,
  number: number,
) {
  const { value } = useConfirmedRead(
    readProjectPullRequest({ connection, projectId, number }),
  );
  const inventory = useInventory(connection);
  if (value.kind !== 'available') return undefined;
  const project = inventory.projects.find(
    (entry) => entry.id === projectId && entry.available,
  );
  const worktree = project?.worktrees.find(
    (entry) => entry.available && entry.branch === value.pullRequest.headBranch,
  );
  return worktree ? { projectId, worktreeId: worktree.id } : undefined;
}
