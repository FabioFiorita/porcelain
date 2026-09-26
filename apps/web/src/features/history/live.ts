import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import type { QueryClient } from '@tanstack/react-query';

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

async function onGitReceipt(
  client: QueryClient,
  environmentId: string,
  receipt: RunGitActionResponse,
) {
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      isHistoryQuery(
        query.queryKey,
        environmentId,
        receipt.projectId,
        receipt.worktreeId,
      ),
  };
  const active = client
    .getQueryCache()
    .findAll(filters)
    .filter((query) => query.isActive());
  await client.invalidateQueries(filters);
  await Promise.all(
    active.map(async (query) => {
      if (query.state.isInvalidated && query.state.status === 'success')
        await query.fetch().catch(() => undefined);
      if (query.state.isInvalidated && query.state.status === 'success')
        throw new Error(
          'Git state refresh was interrupted. Check the action again.',
        );
    }),
  );
}

export default { onNotice, onGitReceipt };
