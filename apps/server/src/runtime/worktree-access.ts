import type { WorktreeAccessFailure } from '../ports/worktree-access-failure.ts';
import type { WorktreeChangedError } from '@porcelain/kernel/errors';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { Cause } from 'effect';
import { Effect } from 'effect';
import type { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import type { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import type { Lanes } from './lanes.ts';
import type { LaneKeys } from './lane-keys.ts';
import {
  withReadLease,
  withWriteLease,
  type WorktreeRead,
  type WorktreeWrite,
} from '@porcelain/effects';

export class WorktreeAccess {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly consistency: WorktreeConsistencyProbe;
  private readonly lanes: Lanes;
  private readonly keys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    consistency: WorktreeConsistencyProbe,
    lanes: Lanes,
    keys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.consistency = consistency;
    this.lanes = lanes;
    this.keys = keys;
  }

  read<A, E>(
    worktreeId: string,
    operation: (worktree: ListedWorktree) => Effect.Effect<A, E, WorktreeRead>,
  ): Effect.Effect<A, E | WorktreeAccessFailure> {
    return this.run(worktreeId, 'read', (worktree) =>
      withReadLease(worktree.id, operation(worktree)),
    );
  }

  write<A, E>(
    worktreeId: string,
    operation: (
      worktree: ListedWorktree,
    ) => Effect.Effect<A, E, WorktreeRead | WorktreeWrite>,
    committed?: () => Effect.Effect<void>,
  ): Effect.Effect<A, E | WorktreeAccessFailure> {
    return Effect.suspend(() => {
      let confirmed = false;
      return this.run(
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

  reviews<A, E>(
    worktreeId: string,
    mode: 'read' | 'write',
    operation: (worktree: ListedWorktree) => Effect.Effect<A, E, WorktreeRead>,
  ): Effect.Effect<A, E | WorktreeAccessFailure> {
    return Effect.gen({ self: this }, function* () {
      const worktree = yield* this.checkWorktree.execute({
        worktreeId,
        requireAvailableProject: false,
      });
      const work = () =>
        Effect.flatMap(this.consistency.execute({ worktree }), () =>
          withReadLease(worktree.id, operation(worktree)),
        );
      return yield* mode === 'read'
        ? this.lanes.runConsistent(this.keys.reviews(worktree), worktree, work)
        : this.lanes.run(this.keys.reviews(worktree), 'write', work);
    });
  }

  transaction<Prepared, A, E, F>(
    worktreeId: string,
    prepare: (
      worktree: ListedWorktree,
    ) => Effect.Effect<Prepared, E, WorktreeRead>,
    commit: (prepared: Prepared) => Effect.Effect<A, F>,
    committed: (value: A) => Effect.Effect<void>,
    options: { requireAvailableProject?: boolean } = {},
  ): Effect.Effect<A, E | F | WorktreeAccessFailure> {
    return Effect.gen({ self: this }, function* () {
      const worktree = yield* this.checkWorktree.execute({
        worktreeId,
        requireAvailableProject: options.requireAvailableProject ?? false,
      });
      return yield* this.lanes.transaction(
        this.keys.reviews(worktree),
        () =>
          Effect.flatMap(this.consistency.execute({ worktree }), () =>
            withReadLease(worktree.id, prepare(worktree)),
          ),
        (prepared) =>
          Effect.flatMap(this.consistency.execute({ worktree }), () =>
            commit(prepared),
          ),
        committed,
      );
    });
  }

  background<E>(
    worktree: ListedWorktree,
    operation: () => Effect.Effect<void, E, WorktreeRead | WorktreeWrite>,
    onFailure: (
      cause: Cause.Cause<E | WorktreeChangedError>,
    ) => Effect.Effect<void>,
    options: { deadlineMs: number },
  ): Effect.Effect<void> {
    return this.lanes.background(
      this.keys.repository(worktree),
      () =>
        Effect.flatMap(this.consistency.execute({ worktree }), () =>
          withWriteLease(worktree.id, operation()),
        ),
      onFailure,
      options,
    );
  }

  private run<A, E>(
    worktreeId: string,
    mode: 'read' | 'write',
    operation: (worktree: ListedWorktree) => Effect.Effect<A, E>,
    settled?: () => Effect.Effect<void>,
  ): Effect.Effect<A, E | WorktreeAccessFailure> {
    return Effect.gen({ self: this }, function* () {
      const worktree = yield* this.checkWorktree.execute({
        worktreeId,
        requireAvailableProject: mode === 'write',
      });
      const work = () =>
        Effect.flatMap(this.consistency.execute({ worktree }), () =>
          operation(worktree),
        );
      return yield* mode === 'read'
        ? this.lanes.runConsistent(
            this.keys.repository(worktree),
            worktree,
            work,
          )
        : this.lanes.run(this.keys.repository(worktree), 'write', work, {
            settled,
          });
    });
  }
}
