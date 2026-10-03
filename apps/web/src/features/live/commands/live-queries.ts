import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import {
  LIVE_PATHS_PER_WORKTREE,
  LIVE_PROJECTS,
  LIVE_WORKTREES,
} from '@porcelain/contracts/shared';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Connection } from '@/shared/workspace/connection';
import {
  fileSurfaces,
  gitSurfaces,
  reviewSurfaceFilters,
} from '@/shared/query/keys';
import { isTerminal } from '@/shared/query/operation-store';

type Receipt = RunGitActionResponse;

type GitReceipts = {
  read: (
    connection: Connection,
    request: {
      projectId: string;
      worktreeId: string;
      requestId: string;
      signal: AbortSignal;
    },
  ) => Promise<Receipt>;
  refresh: (
    client: QueryClient,
    environmentId: string,
    receipt: Receipt,
  ) => Promise<void>;
};

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

async function applyLiveNotice(
  client: QueryClient,
  environmentId: string,
  notice: LiveNotice,
  receipts: GitReceipts,
) {
  if (notice.type === 'ready' || notice.type === 'heartbeat') return;
  if (notice.type === 'git-action') {
    await receipts.refresh(client, environmentId, notice.receipt);
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
    await invalidateSurfaces(client, environmentId, notice, fileSurfaces);
    await notifyFeatures(client, environmentId, notice);
    return;
  }
  if (notice.change === 'git') {
    await invalidateSurfaces(client, environmentId, notice, gitSurfaces);
    await notifyFeatures(client, environmentId, notice);
    return;
  }
  await notifyFeatures(client, environmentId, notice);
}

function connectLiveQueries(
  client: QueryClient,
  connection: Connection,
  onUnauthorized: () => void,
  receipts: GitReceipts,
) {
  const lifecycle = new AbortController();
  const recoverPending = () => {
    for (const operation of connection.operations.list()) {
      if (operation.receipt && isTerminal(operation.receipt)) continue;
      void receipts
        .read(connection, {
          projectId: operation.projectId,
          worktreeId: operation.worktreeId,
          requestId: operation.requestId,
          signal: connection.controller.signal,
        })
        .then(async (receipt) => {
          if (connection.controller.signal.aborted || lifecycle.signal.aborted)
            return;
          await applyLiveNotice(
            client,
            connection.environmentId,
            {
              type: 'git-action',
              projectId: receipt.projectId,
              worktreeId: receipt.worktreeId,
              receipt,
            },
            receipts,
          );
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
      void applyLiveNotice(
        client,
        connection.environmentId,
        notice,
        receipts,
      ).then(
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
  receipts: GitReceipts,
) {
  const client = useQueryClient();
  useEffect(() => {
    if (!connection) return;
    return connectLiveQueries(client, connection, onUnauthorized, receipts);
  }, [client, connection, onUnauthorized, receipts]);
}
