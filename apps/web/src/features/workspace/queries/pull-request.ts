import { readReview } from '@porcelain/client/reviews';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { useInventory } from '@/features/projects/index';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { Connection } from '@/shared/workspace/connection';

export function usePullRequestCheckout(
  connection: Connection,
  reviewId: string,
) {
  const { value } = useConfirmedRead(readReview({ connection, reviewId }));
  const inventory = useInventory(connection);
  if (!value.review || !value.revision) return undefined;
  const project = inventory.projects.find(
    (entry) => entry.id === value.review?.projectId,
  );
  const worktree = project?.worktrees.find(
    (entry) => worktreeLabel(entry.branch) === value.review?.branch,
  );
  return {
    projectId: value.review.projectId,
    worktreeId: worktree?.id ?? value.revision.content.worktreeId,
  };
}
