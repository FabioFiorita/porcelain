import { Clock, Effect, Option, Stream } from 'effect';
import { AsyncResult, Atom, AtomRegistry } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { AccessPlatform } from '../../access/ports/access-platform.ts';
import type { EnvironmentConnection } from '../../access/ports/connection-factory.ts';
import type { Remote, RemoteStatus } from '../../access/rules/remotes.ts';
import { readRemoteConnectionStatus } from '../../access/queries/environments.ts';
import { projectWorktreeSnapshot } from '../rules/worktree-snapshot.ts';
import {
  WorktreeSnapshots,
  worktreeSnapshotPairing,
} from '../store/worktree-snapshot.ts';
import { readInventory } from './inventory.ts';

function rejectsSnapshot(status: RemoteStatus) {
  return (
    status.kind === 'needs-pairing' ||
    status.kind === 'other-server' ||
    status.kind === 'incompatible'
  );
}

export const readWorktreeSnapshot = Effect.fn('WorktreeSnapshots.watch')(
  function* ({
    remote,
    connection,
  }: {
    remote: Remote;
    connection: RuntimeConnection & Pick<EnvironmentConnection, 'liveUpdates'>;
  }) {
    const pairing = worktreeSnapshotPairing(remote);
    if (pairing === undefined) return Stream.make(undefined);
    const storage = yield* WorktreeSnapshots;
    const platform = yield* AccessPlatform;
    const registry = yield* AtomRegistry.AtomRegistry;
    const inventory = readInventory(connection);
    const status = readRemoteConnectionStatus(platform, remote, connection);
    const environmentId = connection.environmentId;
    const saved = Atom.make(yield* storage.read(environmentId, pairing)).pipe(
      Atom.setIdleTTL(0),
    );
    const displayed = Atom.readable((get) => {
      const result = get(inventory);
      const snapshot = get(saved);
      return {
        result,
        snapshot,
        connectionStatus:
          snapshot?.rows.length && Option.isNone(AsyncResult.value(result))
            ? get(status)
            : undefined,
      };
    }).pipe(Atom.setIdleTTL(0));
    let confirmed: Option.Option<
      Parameters<typeof projectWorktreeSnapshot>[0]
    > = Option.none();
    return AtomRegistry.toStream(registry, displayed).pipe(
      Stream.mapEffect(({ result, snapshot, connectionStatus }) =>
        Effect.gen(function* () {
          if (connectionStatus && rejectsSnapshot(connectionStatus)) {
            registry.set(saved, undefined);
            yield* storage.remove(environmentId, pairing);
            confirmed = Option.none();
            return undefined;
          }
          if (AsyncResult.isSuccess(result) && !result.waiting) {
            if (Option.getOrUndefined(confirmed) !== result.value) {
              confirmed = Option.some(result.value);
              const next = projectWorktreeSnapshot(
                result.value,
                pairing,
                yield* Clock.currentTimeMillis,
              );
              yield* storage.write(environmentId, next);
              registry.set(saved, next);
            }
          }
          return Option.isSome(AsyncResult.value(result))
            ? undefined
            : snapshot;
        }),
      ),
      Stream.changes,
    );
  },
);

export function collectWorktreeSnapshots<
  Computer extends { remote: Remote },
  Snapshot,
  E,
>(
  computerSnapshot: (
    computer: Computer,
  ) => Atom.Atom<AsyncResult.AsyncResult<Snapshot | undefined, E>>,
) {
  return Atom.family((computers: readonly Computer[]) =>
    Atom.readable((get) =>
      computers.flatMap((computer) => {
        const snapshot = Option.getOrUndefined(
          AsyncResult.value(get(computerSnapshot(computer))),
        );
        return snapshot
          ? [{ environmentId: computer.remote.environmentId, snapshot }]
          : [];
      }),
    ),
  );
}
