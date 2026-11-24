import { Clock, Effect, Option, Stream } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { AccessPlatform } from '../../access/ports/access-platform.ts';
import type { RemoteConnection } from '../../access/ports/connection-factory.ts';
import type { RemoteStatus } from '../../access/rules/remotes.ts';
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
  function* ({ remote, connection }: RemoteConnection) {
    const pairing = worktreeSnapshotPairing(remote);
    if (pairing === undefined) return Stream.make(undefined);
    const storage = yield* WorktreeSnapshots;
    const platform = yield* AccessPlatform;
    const registry = yield* AtomRegistry.AtomRegistry;
    const inventory = readInventory(connection);
    const status = readRemoteConnectionStatus(platform, remote, connection);
    const environmentId = connection.environmentId;
    let snapshot = yield* storage.read(environmentId, pairing);
    let confirmed: Option.Option<
      Parameters<typeof projectWorktreeSnapshot>[0]
    > = Option.none();
    let rejected = false;
    const first =
      Option.isSome(AsyncResult.value(registry.get(inventory))) ||
      rejectsSnapshot(registry.get(status))
        ? undefined
        : snapshot;
    return Stream.concat(
      Stream.make(first),
      Stream.zipLatestAll(
        AtomRegistry.toStream(registry, inventory),
        AtomRegistry.toStream(registry, status),
      ).pipe(
        Stream.mapEffect(([result, connectionStatus]) =>
          Effect.gen(function* () {
            if (rejectsSnapshot(connectionStatus)) {
              if (!rejected) yield* storage.remove(environmentId, pairing);
              rejected = true;
              snapshot = undefined;
              confirmed = Option.none();
              return undefined;
            }
            rejected = false;
            if (AsyncResult.isSuccess(result) && !result.waiting) {
              if (Option.getOrUndefined(confirmed) !== result.value) {
                confirmed = Option.some(result.value);
                snapshot = projectWorktreeSnapshot(
                  result.value,
                  pairing,
                  yield* Clock.currentTimeMillis,
                );
                yield* storage.write(environmentId, snapshot);
              }
              return undefined;
            }
            return Option.isSome(AsyncResult.value(result))
              ? undefined
              : snapshot;
          }),
        ),
      ),
    );
  },
);
