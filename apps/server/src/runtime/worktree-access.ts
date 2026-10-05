import { type WorktreeAccessFailure } from '../ports/worktree-access-failure.ts';
import { type WorktreeChangedError } from '@porcelain/kernel/errors';
import { type ListedWorktree } from '@porcelain/projects/models';
import { type Cause, Context, Effect, Layer } from 'effect';
import { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import { Lanes } from './lanes.ts';
import { LaneKeys } from './lane-keys.ts';
import {
  withReadLease,
  withWriteLease,
  type WorktreeRead,
  type WorktreeWrite,
} from '@porcelain/effects';

export class WorktreeAccess extends Context.Service<
  WorktreeAccess,
  {
    readonly read: <A, E>(
      worktreeId: string,
      operation: (
        worktree: ListedWorktree,
      ) => Effect.Effect<A, E, WorktreeRead>,
    ) => Effect.Effect<A, E | WorktreeAccessFailure>;
    readonly write: <A, E>(
      worktreeId: string,
      operation: (
        worktree: ListedWorktree,
      ) => Effect.Effect<A, E, WorktreeRead | WorktreeWrite>,
      committed?: () => Effect.Effect<void>,
    ) => Effect.Effect<A, E | WorktreeAccessFailure>;
    readonly reviews: <A, E>(
      worktreeId: string,
      mode: 'read' | 'write',
      operation: (
        worktree: ListedWorktree,
      ) => Effect.Effect<A, E, WorktreeRead>,
    ) => Effect.Effect<A, E | WorktreeAccessFailure>;
    readonly transaction: <Prepared, A, E, F>(
      worktreeId: string,
      prepare: (
        worktree: ListedWorktree,
      ) => Effect.Effect<Prepared, E, WorktreeRead>,
      commit: (prepared: Prepared) => Effect.Effect<A, F>,
      committed: (value: A) => Effect.Effect<void>,
      options?: { requireAvailableProject?: boolean },
    ) => Effect.Effect<A, E | F | WorktreeAccessFailure>;
    readonly background: <E>(
      worktree: ListedWorktree,
      operation: () => Effect.Effect<void, E, WorktreeRead | WorktreeWrite>,
      onFailure: (
        cause: Cause.Cause<E | WorktreeChangedError>,
      ) => Effect.Effect<void>,
      options: { deadlineMs: number },
    ) => Effect.Effect<void>;
  }
>()('@porcelain/server/WorktreeAccess') {
  static readonly layer = Layer.effect(
    WorktreeAccess,
    Effect.gen(function* () {
      const checkWorktree = yield* CheckWorktreeUseCasePort;
      const consistency = yield* WorktreeConsistencyProbe;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;

      function read<A, E>(
        worktreeId: string,
        operation: (
          worktree: ListedWorktree,
        ) => Effect.Effect<A, E, WorktreeRead>,
      ): Effect.Effect<A, E | WorktreeAccessFailure> {
        return run(worktreeId, 'read', (worktree) =>
          withReadLease(worktree.id, operation(worktree)),
        );
      }
      function write<A, E>(
        worktreeId: string,
        operation: (
          worktree: ListedWorktree,
        ) => Effect.Effect<A, E, WorktreeRead | WorktreeWrite>,
        committed?: () => Effect.Effect<void>,
      ): Effect.Effect<A, E | WorktreeAccessFailure> {
        return Effect.suspend(() => {
          let confirmed = false;
          return run(
            worktreeId,
            'write',
            (worktree) =>
              withWriteLease(worktree.id, operation(worktree), () => {
                confirmed = true;
              }),
            () => (confirmed && committed ? committed() : Effect.void),
          );
        });
      }
      function reviews<A, E>(
        worktreeId: string,
        mode: 'read' | 'write',
        operation: (
          worktree: ListedWorktree,
        ) => Effect.Effect<A, E, WorktreeRead>,
      ): Effect.Effect<A, E | WorktreeAccessFailure> {
        return Effect.gen(function* () {
          const worktree = yield* checkWorktree.execute({
            worktreeId,
            requireAvailableProject: false,
          });
          const work = () =>
            Effect.flatMap(consistency.execute({ worktree }), () =>
              withReadLease(worktree.id, operation(worktree)),
            );
          return yield* mode === 'read'
            ? lanes.runConsistent(keys.reviews(worktree), worktree, work)
            : lanes.run(keys.reviews(worktree), 'write', work);
        });
      }
      function transaction<Prepared, A, E, F>(
        worktreeId: string,
        prepare: (
          worktree: ListedWorktree,
        ) => Effect.Effect<Prepared, E, WorktreeRead>,
        commit: (prepared: Prepared) => Effect.Effect<A, F>,
        committed: (value: A) => Effect.Effect<void>,
        options: { requireAvailableProject?: boolean } = {},
      ): Effect.Effect<A, E | F | WorktreeAccessFailure> {
        return Effect.gen(function* () {
          const worktree = yield* checkWorktree.execute({
            worktreeId,
            requireAvailableProject: options.requireAvailableProject ?? false,
          });
          return yield* lanes.transaction(
            keys.reviews(worktree),
            () =>
              Effect.flatMap(consistency.execute({ worktree }), () =>
                withReadLease(worktree.id, prepare(worktree)),
              ),
            (prepared) =>
              Effect.flatMap(consistency.execute({ worktree }), () =>
                commit(prepared),
              ),
            committed,
          );
        });
      }
      function background<E>(
        worktree: ListedWorktree,
        operation: () => Effect.Effect<void, E, WorktreeRead | WorktreeWrite>,
        onFailure: (
          cause: Cause.Cause<E | WorktreeChangedError>,
        ) => Effect.Effect<void>,
        options: { deadlineMs: number },
      ): Effect.Effect<void> {
        return lanes.background(
          keys.repository(worktree),
          () =>
            Effect.flatMap(consistency.execute({ worktree }), () =>
              withWriteLease(worktree.id, operation()),
            ),
          onFailure,
          options,
        );
      }
      function run<A, E>(
        worktreeId: string,
        mode: 'read' | 'write',
        operation: (worktree: ListedWorktree) => Effect.Effect<A, E>,
        settled?: () => Effect.Effect<void>,
      ): Effect.Effect<A, E | WorktreeAccessFailure> {
        return Effect.gen(function* () {
          const worktree = yield* checkWorktree.execute({
            worktreeId,
            requireAvailableProject: mode === 'write',
          });
          const work = () =>
            Effect.flatMap(consistency.execute({ worktree }), () =>
              operation(worktree),
            );
          return yield* mode === 'read'
            ? lanes.runConsistent(keys.repository(worktree), worktree, work)
            : lanes.run(keys.repository(worktree), 'write', work, {
                settled,
              });
        });
      }
      return { read, write, reviews, transaction, background };
    }),
  );
}
