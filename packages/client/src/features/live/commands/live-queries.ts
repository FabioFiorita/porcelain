import type { LiveNotice } from '@porcelain/contracts/access';
import { Effect } from 'effect';
import { nativeOperation, ScopedTasks, withSignal } from '@porcelain/effects';
import {
  LIVE_PATHS_PER_WORKTREE,
  LIVE_PROJECTS,
  LIVE_WORKTREES,
} from '@porcelain/contracts/shared';
import type { QueryClient } from '@tanstack/query-core';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import type { LiveUpdatePort } from '../ports/live-update.ts';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { noticeQueryFilters } from './cache-updates.ts';
import {
  isTerminal,
  type OperationStore,
} from '../../git-actions/store/operations.ts';
import { readGitReceipt } from '../../git-actions/queries/read-receipt.ts';
import { refreshGitReceipt } from '../../git-actions/commands/refresh-receipt.ts';

export type LiveConnection = WorktreeConnection & {
  controller: AbortController;
  operations: OperationStore;
  liveUpdates: LiveUpdatePort;
};

type Watched = { projectId: string; worktreeId: string; paths: Set<string> };

function liveSubscription(
  client: QueryClient,
  environmentId: string,
  operations: OperationStore,
) {
  const inventory = client
    .getQueryCache()
    .findAll({ queryKey: queryKeys.inventory(environmentId) })[0];
  const data =
    inventory && client.getQueryData<ReadInventoryResponse>(inventory.queryKey);
  const watched = new Map<string, Watched>();
  for (const operation of operations.list()) {
    if (operation.receipt && isTerminal(operation.receipt)) continue;
    watched.set(JSON.stringify([operation.projectId, operation.worktreeId]), {
      projectId: operation.projectId,
      worktreeId: operation.worktreeId,
      paths: new Set(),
    });
  }
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
    const key = JSON.stringify([projectId, worktreeId]);
    const entry = watched.get(key) ?? {
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
    watched.set(key, entry);
  }
  return {
    type: 'subscribe' as const,
    projects:
      data?.projects.map((project) => project.id).slice(0, LIVE_PROJECTS) ?? [],
    worktrees: [...watched.values()].slice(0, LIVE_WORKTREES).map((entry) => ({
      projectId: entry.projectId,
      worktreeId: entry.worktreeId,
      paths: [...entry.paths].slice(0, LIVE_PATHS_PER_WORKTREE),
    })),
  };
}

function applyLiveNotice(
  client: QueryClient,
  environmentId: string,
  notice: LiveNotice,
) {
  if (notice.type === 'git-action') {
    return refreshGitReceipt(client, environmentId, notice.receipt);
  }
  return Effect.forEach(
    noticeQueryFilters(environmentId, notice),
    (filters) => nativeOperation(() => client.invalidateQueries(filters)),
    { concurrency: 'unbounded', discard: true },
  );
}

export function connectLiveQueries(
  client: QueryClient,
  connection: LiveConnection,
  onUnauthorized: () => void,
) {
  const lifecycle = new AbortController();
  const tasks = new ScopedTasks();
  const signal = AbortSignal.any([
    connection.controller.signal,
    lifecycle.signal,
  ]);
  const recoverPending = () => {
    for (const operation of connection.operations.list()) {
      if (operation.receipt && isTerminal(operation.receipt)) continue;
      const recovery = Effect.gen(function* () {
        const receipt = yield* readGitReceipt(connection, {
          projectId: operation.projectId,
          worktreeId: operation.worktreeId,
          requestId: operation.requestId,
          signal,
        });
        if (signal.aborted) return;
        yield* applyLiveNotice(client, connection.environmentId, {
          type: 'git-action',
          projectId: receipt.projectId,
          worktreeId: receipt.worktreeId,
          receipt,
        });
        if (!signal.aborted) yield* connection.operations.accept(receipt);
      });
      void tasks
        .run(withSignal(recovery, signal).pipe(Effect.ignore))
        .catch(() => undefined);
    }
  };
  const live = connection.liveUpdates.connect({
    signal,
    onNotice: (notice) => {
      if (signal.aborted) return;
      if (notice.type === 'ready') recoverPending();
      const update = Effect.gen(function* () {
        yield* applyLiveNotice(client, connection.environmentId, notice);
        if (
          notice.type === 'git-action' &&
          !connection.controller.signal.aborted &&
          !lifecycle.signal.aborted
        )
          yield* connection.operations.accept(notice.receipt);
      }).pipe(
        Effect.catchCause(() =>
          Effect.sync(() => {
            if (!signal.aborted) recoverPending();
          }),
        ),
      );
      void tasks.run(withSignal(update, signal)).catch(() => undefined);
    },
    onReconnect: () => {
      if (signal.aborted) return;
      const refresh = nativeOperation(() =>
        client.invalidateQueries({
          type: 'active',
          predicate: (query) => query.queryKey[1] === connection.environmentId,
        }),
      );
      void tasks.run(withSignal(refresh, signal)).catch(() => undefined);
    },
    onUnauthorized: () => {
      if (!signal.aborted) onUnauthorized();
    },
  });
  let queued = false;
  let sent = '';
  const send = () => {
    queued = false;
    if (signal.aborted) return;
    const subscription = liveSubscription(
      client,
      connection.environmentId,
      connection.operations,
    );
    const serialized = JSON.stringify(subscription);
    if (serialized === sent) return;
    sent = serialized;
    live.subscribe(subscription);
  };
  const changed = () => {
    if (queued || signal.aborted) return;
    queued = true;
    void tasks
      .run(Effect.andThen(Effect.yieldNow, Effect.sync(send)))
      .catch(() => undefined);
  };
  const unsubscribe = client.getQueryCache().subscribe(changed);
  const unsubscribeOperations = connection.operations.subscribe(changed);
  changed();
  return () => {
    unsubscribe();
    unsubscribeOperations?.();
    lifecycle.abort();
    void Effect.runPromise(tasks.close());
  };
}
