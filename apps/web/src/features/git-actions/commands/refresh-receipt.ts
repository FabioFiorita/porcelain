import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import type { QueryClient, QueryFilters } from '@tanstack/react-query';
import {
  fileSurfaces,
  gitSurfaces,
  reviewSurfaceFilters,
} from '@/shared/query/keys';
import { isTerminal } from '@/shared/query/operation-store';

type Receipt = RunGitActionResponse;

type FeatureLive = {
  gitReceiptFilters?: (
    environmentId: string,
    receipt: Receipt,
  ) => QueryFilters | null;
};
const featureLives = Object.values(
  import.meta.glob<{ default: FeatureLive }>('../../*/live.ts', {
    eager: true,
  }),
).map((module) => module.default);

async function refreshActiveQueries(
  client: QueryClient,
  filters: QueryFilters,
) {
  const active = client
    .getQueryCache()
    .findAll(filters)
    .filter((query) => query.isActive());
  await client.invalidateQueries(filters);
  await Promise.all(
    active.map(async (query) => {
      while (query.state.isInvalidated && query.state.status === 'success') {
        await query.fetch().catch(() => undefined);
        if (query.state.fetchStatus === 'idle') break;
      }
      if (query.state.isInvalidated && query.state.status === 'success')
        throw new Error(
          'Git state refresh was interrupted. Check the action again.',
        );
    }),
  );
}

const receiptRefreshes = new WeakMap<QueryClient, Map<string, Promise<void>>>();

export async function refreshGitReceipt(
  client: QueryClient,
  environmentId: string,
  receipt: Receipt,
) {
  if (
    !isTerminal(receipt) ||
    receipt.state === 'rejected' ||
    receipt.state === 'no-change'
  )
    return;
  let pending = receiptRefreshes.get(client);
  if (!pending) {
    pending = new Map();
    receiptRefreshes.set(client, pending);
  }
  const key = JSON.stringify([
    environmentId,
    receipt.projectId,
    receipt.worktreeId,
    receipt.requestId,
  ]);
  const existing = pending.get(key);
  if (existing) return existing;
  const refresh = (async () => {
    const surfaces =
      receipt.action === 'fetch' || receipt.action === 'push'
        ? new Set(['git-status', 'changes'])
        : new Set([...gitSurfaces, ...fileSurfaces]);
    const refreshes = await Promise.allSettled(
      [
        reviewSurfaceFilters(environmentId, receipt, surfaces),
        ...featureLives.flatMap(
          (feature) =>
            feature.gitReceiptFilters?.(environmentId, receipt) ?? [],
        ),
      ].map((filters) => refreshActiveQueries(client, filters)),
    );
    const failed = refreshes.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) throw failed.reason;
  })();
  pending.set(key, refresh);
  try {
    await refresh;
  } finally {
    pending.delete(key);
  }
}
