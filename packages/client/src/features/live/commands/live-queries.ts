import type { LiveNotice } from '@porcelain/contracts/access';
import { type Context, Effect, FiberMap, HashMap, Layer, Stream } from 'effect';
import { AsyncResult, Atom, AtomRegistry, Reactivity } from 'effect/reactivity';
import { Option } from 'effect';
import { readInventory } from '../../projects/queries/inventory.ts';
import { inventoryRuntime } from '../../projects/store/inventory.ts';
import { withSignal } from '@porcelain/effects';
import {
  LIVE_PATHS_PER_WORKTREE,
  LIVE_PROJECTS,
  LIVE_WORKTREES,
} from '@porcelain/contracts/shared';
import type { GitConnection } from '../../git-actions/commands/git-action-controller.ts';
import type { LiveUpdatePort } from '../ports/live-update.ts';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { noticeReadKeys } from './cache-updates.ts';
import {
  ReadSubscriptions,
  type ReadSubscription,
} from '../../../shared/api/read-subscriptions.ts';
import {
  isTerminal,
  OperationStore,
} from '../../git-actions/store/operations.ts';
import { readGitReceipt } from '../../git-actions/queries/read-receipt.ts';
import {
  GitReceiptRefresh,
  receiptRuntime,
} from '../../git-actions/commands/refresh-receipt.ts';

export type LiveConnection = GitConnection & {
  controller: AbortController;
  operations: Context.Service.Shape<typeof OperationStore>;
  liveUpdates: LiveUpdatePort;
};

type Watched = { projectId: string; worktreeId: string; paths: Set<string> };

function liveSubscription(
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

const connectLiveSession = Effect.fn('Live.connect')(function* (
  connection: LiveConnection,
  onUnauthorized: (() => void) | undefined,
) {
  const registry = yield* AtomRegistry.AtomRegistry;
  const reads = yield* ReadSubscriptions;
  const operations = yield* OperationStore;
  const refresh = yield* GitReceiptRefresh;
  const reactivity = yield* Reactivity.Reactivity;
  const lifecycle = yield* Effect.acquireRelease(
    Effect.sync(() => new AbortController()),
    (controller) => Effect.sync(() => controller.abort()),
  );
  const signal = AbortSignal.any([
    connection.controller.signal,
    lifecycle.signal,
  ]);
  const jobs = yield* FiberMap.make<string | symbol, void>();
  const run = yield* FiberMap.runtime(jobs)();
  const services =
    yield* Effect.context<Effect.Services<ReturnType<typeof readGitReceipt>>>();
  const applyNotice = Effect.fn('Live.applyNotice')(function* (
    notice: LiveNotice,
  ) {
    if (notice.type === 'git-action')
      return yield* refresh.refresh(notice.receipt);
    if (notice.type === 'inventory' || notice.type === 'worktree')
      yield* reactivity.invalidate([
        queryKeys.inventory(connection.environmentId),
      ]);
    if (notice.type === 'project' && notice.change === 'preferences')
      yield* reactivity.invalidate([
        queryKeys.filePreferences(connection.environmentId, notice.projectId),
      ]);
    yield* reactivity.invalidate(
      noticeReadKeys(connection.environmentId, notice),
    );
  });
  const recoverPending = () => {
    for (const operation of operations.state.value.operations.values()) {
      if (operation.receipt && isTerminal(operation.receipt)) continue;
      run(
        Symbol(),
        withSignal(
          Effect.gen(function* () {
            const receipt = yield* readGitReceipt(connection, {
              ...operation,
              signal,
            }).pipe(Effect.provideContext(services));
            if (signal.aborted) return;
            yield* refresh.refresh(receipt);
            if (!signal.aborted) yield* operations.accept(receipt);
          }),
          signal,
        ).pipe(Effect.ignore, Effect.asVoid),
      );
    }
  };
  const live = connection.liveUpdates.connect({
    signal,
    onNotice: (notice) => {
      if (signal.aborted) return;
      if (notice.type === 'ready') recoverPending();
      run(
        Symbol(),
        withSignal(
          Effect.gen(function* () {
            yield* applyNotice(notice);
            if (notice.type === 'git-action' && !signal.aborted)
              yield* operations.accept(notice.receipt);
          }),
          signal,
        ).pipe(
          Effect.catchCause(() =>
            Effect.sync(() => {
              if (!signal.aborted) recoverPending();
            }),
          ),
          Effect.asVoid,
        ),
      );
    },
    onReconnect: () => {
      if (!signal.aborted)
        run(
          Symbol(),
          reactivity.invalidate([
            queryKeys.environment(connection.environmentId),
          ]),
        );
    },
    onUnauthorized: () => {
      if (signal.aborted) return;
      if (onUnauthorized) onUnauthorized();
      else
        run(
          Symbol(),
          reactivity.invalidate([
            queryKeys.inventory(connection.environmentId),
          ]),
        );
    },
  });
  let sent = '';
  const send = Effect.gen(function* () {
    if (signal.aborted) return;
    const subscription = liveSubscription(
      operations,
      Option.getOrUndefined(
        AsyncResult.value(registry.get(readInventory(connection))),
      ),
      HashMap.values(yield* reads.snapshot),
    );
    const serialized = JSON.stringify(subscription);
    if (serialized === sent) return;
    sent = serialized;
    live.subscribe(subscription);
  });
  const changed = () => {
    if (!signal.aborted)
      run('subscription', Effect.andThen(Effect.yieldNow, send), {
        onlyIfMissing: true,
      });
  };
  yield* Effect.acquireRelease(
    Effect.sync(() => registry.subscribe(readInventory(connection), changed)),
    (unsubscribe) => Effect.sync(unsubscribe),
  );
  yield* Effect.acquireRelease(
    Effect.sync(() => operations.state.subscribe(changed)),
    (unsubscribe) => Effect.sync(() => unsubscribe?.()),
  );
  run(
    Symbol(),
    Stream.runForEach(reads.changes, () => Effect.sync(changed)),
  );
  changed();
});

const liveRuntime = Atom.family((connection: LiveConnection) =>
  connection.atoms((get) =>
    Layer.mergeAll(
      get(inventoryRuntime(connection).layer),
      get(receiptRuntime(connection).layer),
      Layer.effectContext(connection.runtime.contextEffect),
    ),
  ),
);
export const liveQueries = Atom.family(
  ({
    connection,
    onUnauthorized,
  }: {
    connection: LiveConnection;
    onUnauthorized?: () => void;
  }) =>
    liveRuntime(connection)
      .atom(connectLiveSession(connection, onUnauthorized))
      .pipe(Atom.setIdleTTL(0)),
);

export const inactiveLiveQueries = Atom.make(AsyncResult.success(undefined));
