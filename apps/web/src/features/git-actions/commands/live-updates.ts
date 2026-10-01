import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import {
  LIVE_PATHS_PER_WORKTREE,
  LIVE_PROJECTS,
  LIVE_WORKTREES,
} from '@porcelain/contracts/shared';
import {
  type QueryClient,
  type QueryFilters,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Connection } from '@/shared/workspace/connection';
import { reviewSurfaceFilters } from '@/shared/query/keys';
import { isTerminal } from '@/shared/query/operation-store';
import { readGitReceipt } from './read-receipt';

type Receipt = RunGitActionResponse;

type Watched = { projectId: string; worktreeId: string; paths: Set<string> };
type FeatureLive = {
  subscriptionProjects?: (
    client: QueryClient,
    environmentId: string,
  ) => string[];
  onNotice?: (
    client: QueryClient,
    environmentId: string,
    notice: LiveNotice,
  ) => Promise<void>;
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

async function notifyFeatures(
  client: QueryClient,
  environmentId: string,
  notice: LiveNotice,
) {
  await Promise.all(
    featureLives.flatMap((feature) =>
      feature.onNotice ? [feature.onNotice(client, environmentId, notice)] : [],
    ),
  );
}

function liveSubscription(client: QueryClient, environmentId: string) {
  const watched = new Map<string, Watched>();
  for (const query of client.getQueryCache().findAll({ type: 'active' })) {
    const [root, environment, projectId, worktreeId, surface, path] =
      query.queryKey;
    if (
      root !== 'review' ||
      environment !== environmentId ||
      typeof projectId !== 'string' ||
      typeof worktreeId !== 'string' ||
      typeof surface !== 'string'
    )
      continue;
    const entry = watched.get(worktreeId) ?? {
      projectId,
      worktreeId,
      paths: new Set<string>(),
    };
    if (
      (surface === 'text' ||
        surface === 'directory' ||
        surface === 'asset' ||
        surface === 'html-preview' ||
        surface === 'step-lines') &&
      typeof path === 'string' &&
      path !== ''
    )
      entry.paths.add(path);
    watched.set(worktreeId, entry);
  }
  return {
    type: 'subscribe' as const,
    projects: featureLives
      .flatMap(
        (feature) =>
          feature.subscriptionProjects?.(client, environmentId) ?? [],
      )
      .slice(0, LIVE_PROJECTS),
    worktrees: [...watched.values()].slice(0, LIVE_WORKTREES).map((entry) => ({
      projectId: entry.projectId,
      worktreeId: entry.worktreeId,
      paths: [...entry.paths].slice(0, LIVE_PATHS_PER_WORKTREE),
    })),
  };
}

const FILE_SURFACES = new Set([
  'changes',
  'directory',
  'text',
  'paths',
  'git-status',
  'asset',
  'html-preview',
  'step-lines',
]);
const GIT_SURFACES = new Set(['changes', 'git-status', 'paths', 'step-lines']);

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

async function invalidateSurfaces(
  client: QueryClient,
  environmentId: string,
  notice: { projectId: string; worktreeId: string },
  surfaces: ReadonlySet<string>,
) {
  await client.invalidateQueries(
    reviewSurfaceFilters(environmentId, notice, surfaces),
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
        : new Set([...GIT_SURFACES, ...FILE_SURFACES]);
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

async function applyLiveNotice(
  client: QueryClient,
  environmentId: string,
  notice: LiveNotice,
) {
  if (notice.type === 'ready' || notice.type === 'heartbeat') return;
  if (notice.type === 'git-action') {
    await refreshGitReceipt(client, environmentId, notice.receipt);
    return;
  }
  if (notice.type === 'inventory') {
    await notifyFeatures(client, environmentId, notice);
    return;
  }
  if (notice.type === 'project') {
    await notifyFeatures(client, environmentId, notice);
    return;
  }
  if (notice.change === 'files') {
    await invalidateSurfaces(client, environmentId, notice, FILE_SURFACES);
    await notifyFeatures(client, environmentId, notice);
    return;
  }
  if (notice.change === 'git') {
    await invalidateSurfaces(client, environmentId, notice, GIT_SURFACES);
    await notifyFeatures(client, environmentId, notice);
    return;
  }
  await notifyFeatures(client, environmentId, notice);
}

function connectLiveQueries(
  client: QueryClient,
  connection: Connection,
  onUnauthorized: () => void,
) {
  const lifecycle = new AbortController();
  const recoverPending = () => {
    for (const operation of connection.operations.list()) {
      if (operation.receipt && isTerminal(operation.receipt)) continue;
      void readGitReceipt(connection, {
        projectId: operation.projectId,
        worktreeId: operation.worktreeId,
        requestId: operation.requestId,
        signal: connection.controller.signal,
      })
        .then(async (receipt) => {
          if (connection.controller.signal.aborted || lifecycle.signal.aborted)
            return;
          await applyLiveNotice(client, connection.environmentId, {
            type: 'git-action',
            projectId: receipt.projectId,
            worktreeId: receipt.worktreeId,
            receipt,
          });
          if (
            !connection.controller.signal.aborted &&
            !lifecycle.signal.aborted
          )
            connection.operations.accept(receipt);
        })
        .catch(() => {});
    }
  };
  const live = connection.liveUpdates.connect({
    signal: AbortSignal.any([connection.controller.signal, lifecycle.signal]),
    onNotice: (notice) => {
      if (notice.type === 'ready') recoverPending();
      void applyLiveNotice(client, connection.environmentId, notice).then(
        () => {
          if (
            notice.type === 'git-action' &&
            !connection.controller.signal.aborted &&
            !lifecycle.signal.aborted
          )
            connection.operations.accept(notice.receipt);
        },
        () => recoverPending(),
      );
    },
    onReconnect: () => {
      void client.invalidateQueries({
        type: 'active',
        predicate: (query) => query.queryKey[1] === connection.environmentId,
      });
      recoverPending();
    },
    onUnauthorized,
  });
  let queued = false;
  let sent = '';
  const send = () => {
    queued = false;
    const subscription = liveSubscription(client, connection.environmentId);
    for (const operation of connection.operations.list()) {
      if (operation.receipt && isTerminal(operation.receipt)) continue;
      if (
        !subscription.worktrees.some(
          (entry) =>
            entry.worktreeId === operation.worktreeId &&
            entry.projectId === operation.projectId,
        )
      )
        subscription.worktrees.push({
          projectId: operation.projectId,
          worktreeId: operation.worktreeId,
          paths: [],
        });
    }
    const serialized = JSON.stringify(subscription);
    if (serialized === sent) return;
    sent = serialized;
    live.subscribe(subscription);
  };
  const changed = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(send);
  };
  const unsubscribe = client.getQueryCache().subscribe(changed);
  const unsubscribeOperations = connection.operations.subscribe(changed);
  changed();
  return () => {
    unsubscribe();
    unsubscribeOperations?.();
    lifecycle.abort();
  };
}

export function useLiveQueries(
  connection: Connection | null,
  onUnauthorized: () => void,
) {
  const client = useQueryClient();
  useEffect(() => {
    if (!connection) return;
    return connectLiveQueries(client, connection, onUnauthorized);
  }, [client, connection, onUnauthorized]);
}
