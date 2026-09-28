import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import type { QueryClient, QueryFilters } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import type { ReviewScope } from './rules/review';

const PUBLISHED_SURFACES = new Set(['review', 'reviewed-layers']);
const CHANGE_SURFACES = {
  files: PUBLISHED_SURFACES,
  git: PUBLISHED_SURFACES,
  review: PUBLISHED_SURFACES,
  reviewed: new Set(['reviewed', 'reviewed-layers']),
  comments: new Set(['comments']),
} as const;

function surfaceFilters(
  environmentId: string,
  scope: ReviewScope,
  surfaces: ReadonlySet<string>,
): QueryFilters {
  const prefix = queryKeys.review(environmentId, scope);
  return {
    queryKey: prefix,
    predicate: (query) => surfaces.has(String(query.queryKey[prefix.length])),
  };
}

async function onNotice(
  client: QueryClient,
  environmentId: string,
  notice: LiveNotice,
) {
  if (notice.type !== 'worktree') return;
  await client.invalidateQueries(
    surfaceFilters(environmentId, notice, CHANGE_SURFACES[notice.change]),
  );
}

async function onGitReceipt(
  client: QueryClient,
  environmentId: string,
  receipt: RunGitActionResponse,
) {
  if (receipt.action === 'fetch' || receipt.action === 'push') return;
  const filters = surfaceFilters(environmentId, receipt, PUBLISHED_SURFACES);
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
