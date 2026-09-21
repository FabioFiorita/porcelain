import type { LiveNotice } from '@porcelain/contracts/live-updates';
import type { QueryClient, QueryFilters } from '@tanstack/react-query';
import type { Api } from '../api/api';
import type { Receipt } from '../domain/git-action';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { isTerminal, type OperationStore } from './operation-store';

type Connection = {
  environmentId: string;
  controller: AbortController;
  operations?: OperationStore;
};

type Watched = { projectId: string; worktreeId: string; paths: Set<string> };

export function liveSubscription(client: QueryClient, environmentId: string) {
  const watched = new Map<string, Watched>();
  for (const query of client.getQueryCache().findAll({ type: 'active' })) {
    const [root, environment, projectId, worktreeId, surface, path] =
      query.queryKey;
    if (
      root !== 'review' ||
      environment !== environmentId ||
      typeof projectId !== 'string' ||
      typeof worktreeId !== 'string'
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
      typeof path === 'string'
    )
      entry.paths.add(path);
    watched.set(worktreeId, entry);
  }
  return {
    type: 'subscribe' as const,
    projects:
      client
        .getQueryData<{ projects: { id: string }[] }>(
          queryKeys.inventory(environmentId),
        )
        ?.projects.map((project) => project.id)
        .slice(0, 128) ?? [],
    worktrees: [...watched.values()].slice(0, 32).map((entry) => ({
      projectId: entry.projectId,
      worktreeId: entry.worktreeId,
      paths: [...entry.paths].slice(0, 64),
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
  'review',
  'step-lines',
  'reviewed-layers',
]);
const GIT_SURFACES = new Set([
  'changes',
  'git-status',
  'history',
  'branches',
  'paths',
  'review',
  'step-lines',
  'reviewed-layers',
]);

async function refreshActionQueries(
  client: QueryClient,
  filters: QueryFilters,
) {
  const active = client
    .getQueryCache()
    .findAll(filters)
    .filter((query) => query.isActive());
  await client.invalidateQueries(filters);
  // Navigation can cancel an observed read without rejecting invalidation.
  // Finish that read even when its view is no longer mounted.
  await Promise.all(
    active.map(async (query) => {
      if (query.state.isInvalidated && query.state.status === 'success') {
        // A discard may legitimately remove an open file. Its read error belongs
        // to that surface and must not hide the successful action's restore UI.
        await query.fetch().catch(() => undefined);
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
  notice: ReviewScope,
  surfaces: ReadonlySet<string>,
) {
  const prefix = queryKeys.review(environmentId, notice);
  await client.invalidateQueries({
    queryKey: prefix,
    predicate: (query) => surfaces.has(String(query.queryKey[prefix.length])),
  });
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
  // HTTP and live delivery must await the same post-action read.
  const refresh = (async () => {
    const surfaces =
      receipt.action === 'fetch' || receipt.action === 'push'
        ? new Set(['git-status', 'changes', 'history', 'branches'])
        : new Set([...GIT_SURFACES, ...FILE_SURFACES]);
    const prefix = queryKeys.review(environmentId, receipt);
    await refreshActionQueries(client, {
      queryKey: prefix,
      predicate: (query) => surfaces.has(String(query.queryKey[prefix.length])),
    });
    await refreshActionQueries(client, {
      queryKey: queryKeys.inventory(environmentId),
      exact: true,
    });
  })();
  pending.set(key, refresh);
  try {
    await refresh;
  } finally {
    pending.delete(key);
  }
}

export async function applyLiveNotice(
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
    await client.invalidateQueries({
      queryKey: queryKeys.inventory(environmentId),
      exact: true,
    });
    return;
  }
  if (notice.type === 'project') {
    if (notice.change === 'preferences')
      await client.invalidateQueries({
        queryKey: queryKeys.filePreferences(environmentId, notice.projectId),
        exact: true,
      });
    return;
  }
  const inventory = () =>
    client.invalidateQueries({
      queryKey: queryKeys.inventory(environmentId),
      exact: true,
    });
  if (notice.change === 'files') {
    // The server reconciles conservative stale marks while answering changes;
    // refresh the sidebar only after that read can have completed.
    await invalidateSurfaces(client, environmentId, notice, FILE_SURFACES);
    await inventory();
    return;
  }
  if (notice.change === 'git') {
    await invalidateSurfaces(client, environmentId, notice, GIT_SURFACES);
    await inventory();
    return;
  }
  const surfaces =
    notice.change === 'reviewed'
      ? new Set(['reviewed', 'reviewed-layers'])
      : notice.change === 'comments'
        ? new Set(['comments'])
        : new Set(['review', 'reviewed-layers']);
  await invalidateSurfaces(client, environmentId, notice, surfaces);
  await inventory();
}

export function connectLiveQueries(
  api: Api,
  client: QueryClient,
  connection: Connection,
) {
  const lifecycle = new AbortController();
  const recoverPending = () => {
    for (const operation of connection.operations?.list() ?? []) {
      if (operation.receipt && isTerminal(operation.receipt)) continue;
      void api.gitActions
        .receipt({
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
            connection.operations?.accept(receipt);
        })
        .catch(() => {
          /* Retain the request for explicit recovery if the reconnect read fails. */
        });
    }
  };
  const live = api.liveUpdates.connect({
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
            connection.operations?.accept(notice.receipt);
        },
      );
    },
    onReconnect: () => {
      void client.invalidateQueries({ type: 'active' });
      recoverPending();
    },
  });
  let queued = false;
  let sent = '';
  const send = () => {
    queued = false;
    const subscription = liveSubscription(client, connection.environmentId);
    for (const operation of connection.operations?.list() ?? []) {
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
  const unsubscribeOperations = connection.operations?.subscribe(changed);
  changed();
  return () => {
    unsubscribe();
    unsubscribeOperations?.();
    lifecycle.abort();
  };
}
