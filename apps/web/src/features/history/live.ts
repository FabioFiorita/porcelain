import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import type { QueryClient, QueryFilters } from '@tanstack/react-query';

function isHistoryQuery(
  key: readonly unknown[],
  environmentId: string,
  projectId?: string,
  worktreeId?: string,
) {
  return (
    key[0] === 'review' &&
    key[1] === environmentId &&
    (projectId === undefined || key[2] === projectId) &&
    (worktreeId === undefined || key[3] === worktreeId) &&
    key[4] === 'history'
  );
}

async function onNotice(
  client: QueryClient,
  environmentId: string,
  notice: LiveNotice,
) {
  if (notice.type !== 'worktree' || notice.change !== 'git') return;
  await client.invalidateQueries({
    predicate: (query) =>
      isHistoryQuery(
        query.queryKey,
        environmentId,
        notice.projectId,
        notice.worktreeId,
      ),
  });
}

function gitReceiptFilters(
  environmentId: string,
  receipt: RunGitActionResponse,
): QueryFilters {
  return {
    predicate: (query) =>
      isHistoryQuery(
        query.queryKey,
        environmentId,
        receipt.projectId,
        receipt.worktreeId,
      ),
  };
}

export default { onNotice, gitReceiptFilters };
