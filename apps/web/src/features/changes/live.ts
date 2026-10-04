import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import type { QueryClient } from '@tanstack/react-query';
import { reviewSurfaceFilters } from '@porcelain/client/transport';

const BRANCH_SURFACES = new Set(['branch', 'branch-bases']);

async function onNotice(
  client: QueryClient,
  environmentId: string,
  notice: LiveNotice,
) {
  if (notice.type !== 'worktree' || notice.change !== 'git') return;
  await client.invalidateQueries(
    reviewSurfaceFilters(environmentId, notice, BRANCH_SURFACES),
  );
}

function gitReceiptFilters(
  environmentId: string,
  receipt: RunGitActionResponse,
) {
  return reviewSurfaceFilters(environmentId, receipt, BRANCH_SURFACES);
}

export default { onNotice, gitReceiptFilters };
