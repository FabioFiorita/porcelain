import type { Context } from 'effect';
import type { LiveNotice } from '@porcelain/contracts/access';
import { Effect, HashMap, Stream } from 'effect';
import { AsyncResult, Atom, AtomRegistry, Reactivity } from 'effect/reactivity';
import { Option } from 'effect';
import { readInventory } from '../../projects/queries/inventory.ts';
import { inventoryRuntime } from '../../projects/store/inventory.ts';
import { nativeOperation, ScopedTasks, withSignal } from '@porcelain/effects';
import {
  LIVE_PATHS_PER_WORKTREE,
  LIVE_PROJECTS,
  LIVE_WORKTREES,
} from '@porcelain/contracts/shared';
import type { QueryClient } from '@tanstack/query-core';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import type { LiveUpdatePort } from '../ports/live-update.ts';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { noticeQueryFilters, noticeReadKeys } from './cache-updates.ts';
import {
  ReadSubscriptions,
  type ReadSubscription,
} from '../../../shared/api/read-subscriptions.ts';
import {
  isTerminal,
  type OperationStore,
} from '../../git-actions/store/operations.ts';
import { readGitReceipt } from '../../git-actions/queries/read-receipt.ts';
import { refreshGitReceipt } from '../../git-actions/commands/refresh-receipt.ts';

export type LiveConnection = RuntimeConnection & {
  controller: AbortController;
  operations: Context.Service.Shape<typeof OperationStore>;
  liveUpdates: LiveUpdatePort;
};

type Watched = { projectId: string; worktreeId: string; paths: Set<string> };

function liveSubscription(
  client: QueryClient,
  environmentId: string,
  operations: Context.Service.Shape<typeof OperationStore>,
  data: ReadInventoryResponse | undefined,
  reads: Iterable<ReadSubscription>,
) {
  const watched = new Map<string, Watched>();
  for (const operation of [...operations.state.value.operations.values()]) {
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
  for (const read of reads) {
    const key = JSON.stringify([read.projectId, read.worktreeId]);
    const entry = watched.get(key) ?? {
      projectId: read.projectId,
      worktreeId: read.worktreeId,
      paths: new Set<string>(),
    };
    for (const path of read.paths) if (path !== '') entry.paths.add(path);
    watched.set(key, entry);
  }
  return {
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
  return Effect.gen(function* () {
    if (notice.type === 'inventory' || notice.type === 'worktree')
      yield* Reactivity.invalidate([queryKeys.inventory(environmentId)]);
    if (notice.type === 'project' && notice.change === 'preferences')
      yield* Reactivity.invalidate([
        queryKeys.filePreferences(environmentId, notice.projectId),
      ]);
    yield* Reactivity.invalidate(noticeReadKeys(environmentId, notice));
    yield* Effect.forEach(
      noticeQueryFilters(environmentId, notice),
      (filters) => nativeOperation(() => client.invalidateQueries(filters)),
      { concurrency: 'unbounded', discard: true },
    );
  });
}

export function connectLiveQueries(
  client: QueryClient,
  connection: LiveConnection,
  onUnauthorized: (() => void) | undefined,
  registry: AtomRegistry.AtomRegistry,
) {
  const lifecycle = new AbortController();
  const reads = connection.runtime.runSync(ReadSubscriptions);
  const tasks = new ScopedTasks();
  const services = connection.runtime.runSync(
    Effect.context<Reactivity.Reactivity>(),
  );
  const signal = AbortSignal.any([
    connection.controller.signal,
    lifecycle.signal,
  ]);
  const recoverPending = () => {
    for (const operation of [
      ...connection.operations.state.value.operations.values(),
    ]) {
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
        .run(
          withSignal(recovery, signal).pipe(
            Effect.ignore,
            Effect.provideContext(services),
          ),
        )
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
      void tasks
        .run(withSignal(update, signal).pipe(Effect.provideContext(services)))
        .catch(() => undefined);
    },
    onReconnect: () => {
      if (signal.aborted) return;
      const refresh = Effect.andThen(
        Reactivity.invalidate([
          queryKeys.environment(connection.environmentId),
        ]),
        nativeOperation(() =>
          client.invalidateQueries({
            type: 'active',
            predicate: (query) =>
              query.queryKey[1] === connection.environmentId,
          }),
        ),
      );
      void tasks
        .run(withSignal(refresh, signal).pipe(Effect.provideContext(services)))
        .catch(() => undefined);
    },
    onUnauthorized: () => {
      if (!signal.aborted) {
        if (onUnauthorized) onUnauthorized();
        else
          connection.runtime.runSync(
            Reactivity.invalidate([
              queryKeys.inventory(connection.environmentId),
            ]),
          );
      }
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
      Option.getOrUndefined(
        AsyncResult.value(registry.get(readInventory(connection))),
      ),
      HashMap.values(connection.runtime.runSync(reads.snapshot)),
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
  const unsubscribeInventory = registry.subscribe(
    readInventory(connection),
    changed,
  );
  const unsubscribe = client.getQueryCache().subscribe(changed);
  tasks.fork(Stream.runForEach(reads.changes, () => Effect.sync(changed)));
  const unsubscribeOperations = connection.operations.state.subscribe(changed);
  changed();
  return () => {
    unsubscribeInventory();
    unsubscribe();
    unsubscribeOperations?.();
    lifecycle.abort();
    void Effect.runPromise(tasks.close());
  };
}

export const liveQueries = Atom.family(
  ({
    client,
    connection,
    onUnauthorized,
  }: {
    client: QueryClient;
    connection: LiveConnection;
    onUnauthorized?: () => void;
  }) =>
    inventoryRuntime(connection)
      .atom(
        Effect.acquireRelease(
          Effect.gen(function* () {
            const registry = yield* AtomRegistry.AtomRegistry;
            return connectLiveQueries(
              client,
              connection,
              onUnauthorized,
              registry,
            );
          }),
          (close) => Effect.sync(close),
        ).pipe(Effect.asVoid),
      )
      .pipe(Atom.setIdleTTL(0)),
);

export const inactiveLiveQueries = Atom.make(AsyncResult.success(undefined));
