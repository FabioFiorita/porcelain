import { Context, Effect, Layer, Option, Schema, Semaphore } from 'effect';
import { AccessStore } from '../../access/store.ts';
import { connectionRoutes, type Remote } from '../../access/rules/remotes.ts';
import { WorktreeSnapshotStorage } from '../ports/worktree-snapshot-storage.ts';
import {
  worktreeSnapshotJson,
  type WorktreeSnapshot,
} from '../rules/worktree-snapshot.ts';

export function worktreeSnapshotPairing(remote: Remote) {
  const ids = connectionRoutes(remote).flatMap(({ deviceId }) =>
    deviceId ? [deviceId] : [],
  );
  return ids.length > 0 ? JSON.stringify(ids.sort()) : undefined;
}

export class WorktreeSnapshots extends Context.Service<
  WorktreeSnapshots,
  {
    readonly read: (
      environmentId: string,
      pairing: string,
    ) => Effect.Effect<WorktreeSnapshot | undefined>;
    readonly write: (
      environmentId: string,
      snapshot: WorktreeSnapshot,
    ) => Effect.Effect<void>;
    readonly remove: (
      environmentId: string,
      pairing?: string,
    ) => Effect.Effect<void>;
  }
>()('@porcelain/client/WorktreeSnapshots') {
  static readonly layer = Layer.effect(
    WorktreeSnapshots,
    Effect.gen(function* () {
      const access = yield* AccessStore;
      const storage = yield* WorktreeSnapshotStorage;
      const gate = yield* Semaphore.make(1);
      const decode = Schema.decodeUnknownOption(worktreeSnapshotJson);
      const encode = Schema.encodeOption(worktreeSnapshotJson);
      const pairedComputer = (environmentId: string) =>
        access.state.value.remotes.find(
          (entry) => entry.environmentId === environmentId,
        );
      const current = (environmentId: string, pairing: string) => {
        const state = access.state.value;
        const remote = pairedComputer(environmentId);
        return (
          state.status === 'ready' &&
          remote !== undefined &&
          worktreeSnapshotPairing(remote) === pairing
        );
      };
      const remove = (environmentId: string) =>
        storage.remove(environmentId).pipe(Effect.ignore);
      return {
        read: Effect.fn('WorktreeSnapshots.read')((environmentId, pairing) =>
          Effect.gen(function* () {
            if (!current(environmentId, pairing)) return;
            const raw = yield* storage.read(environmentId);
            if (raw === null || !current(environmentId, pairing)) return;
            const saved = Option.getOrUndefined(decode(raw));
            if (saved?.pairing === pairing) return saved;
            yield* remove(environmentId);
          }).pipe(
            Effect.orElseSucceed(() => undefined),
            Semaphore.withPermit(gate),
          ),
        ),
        write: Effect.fn('WorktreeSnapshots.write')((environmentId, snapshot) =>
          Effect.gen(function* () {
            if (!current(environmentId, snapshot.pairing)) return;
            const raw = encode(snapshot);
            if (Option.isSome(raw))
              yield* storage.write(environmentId, raw.value);
          }).pipe(
            Effect.ignore,
            Effect.uninterruptible,
            Semaphore.withPermit(gate),
          ),
        ),
        remove: Effect.fn('WorktreeSnapshots.remove')(
          (environmentId, pairing) =>
            Effect.suspend(() => {
              const canRemove =
                pairing === undefined
                  ? pairedComputer(environmentId) === undefined
                  : current(environmentId, pairing);
              return canRemove ? remove(environmentId) : Effect.void;
            }).pipe(Semaphore.withPermit(gate), Effect.uninterruptible),
        ),
      };
    }),
  );
}
