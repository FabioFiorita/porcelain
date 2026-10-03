import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import type { QueryClient } from '@tanstack/react-query';
import { reviewSurfaceFilters } from '@/shared/query/keys';
import { noticeSurfaces, receiptSurfaces } from './rules/live-surfaces';

async function onNotice(
  client: QueryClient,
  environmentId: string,
  notice: LiveNotice,
) {
  const target = noticeSurfaces(notice);
  if (!target) return;
  await client.invalidateQueries(
    reviewSurfaceFilters(environmentId, target.scope, target.surfaces),
  );
}

function gitReceiptFilters(
  environmentId: string,
  receipt: RunGitActionResponse,
) {
  const target = receiptSurfaces(receipt);
  return target
    ? reviewSurfaceFilters(environmentId, target.scope, target.surfaces)
    : null;
}

export default { onNotice, gitReceiptFilters };
