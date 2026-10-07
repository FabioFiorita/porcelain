import { Context, Effect } from 'effect';

class ReadLease {
  private active = true;
  private readonly worktreeId: string;

  protected constructor(worktreeId: string) {
    this.worktreeId = worktreeId;
  }

  assert(worktreeId: string): void {
    if (!this.active || this.worktreeId !== worktreeId)
      throw new Error('Worktree IO requires its current admitted lease');
  }

  private close(): void {
    this.active = false;
  }

  static read<A, E>(
    this: void,
    worktreeId: string,
    work: Effect.Effect<A, E, WorktreeRead>,
  ): Effect.Effect<A, E> {
    return Effect.acquireUseRelease(
      Effect.sync(() => new ReadLease(worktreeId)),
      (lease) => Effect.provideService(work, WorktreeRead, lease),
      (lease) => Effect.sync(() => lease.close()),
    );
  }

  static write<A, E>(
    this: void,
    worktreeId: string,
    work: Effect.Effect<A, E, WorktreeRead | WorktreeWrite>,
    committed?: () => void,
  ): Effect.Effect<A, E> {
    return Effect.acquireUseRelease(
      Effect.sync(() => new WriteLease(worktreeId, committed)),
      (lease) =>
        work.pipe(
          Effect.provideService(WorktreeRead, lease),
          Effect.provideService(WorktreeWrite, lease),
        ),
      (lease) => Effect.sync(() => lease.close()),
    );
  }
}

class WriteLease extends ReadLease {
  private readonly committed: (() => void) | undefined;
  constructor(worktreeId: string, committed?: () => void) {
    super(worktreeId);
    this.committed = committed;
  }
  assertWrite(worktreeId: string): void {
    this.assert(worktreeId);
  }
  confirmCommit(worktreeId: string): void {
    this.assertWrite(worktreeId);
    this.committed?.();
  }
}

export class WorktreeRead extends Context.Service<WorktreeRead, ReadLease>()(
  '@porcelain/WorktreeRead',
) {}
export class WorktreeWrite extends Context.Service<WorktreeWrite, WriteLease>()(
  '@porcelain/WorktreeWrite',
) {}

export const withReadLease = ReadLease.read;
export const withWriteLease = ReadLease.write;

export function admittedRead<A, E, R>(
  worktreeId: string,
  work: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R | WorktreeRead> {
  return Effect.flatMap(WorktreeRead, (lease) =>
    Effect.andThen(
      Effect.sync(() => lease.assert(worktreeId)),
      work,
    ),
  );
}

export function admittedWrite<A, E, R>(
  worktreeId: string,
  work: (committed: () => void) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R | WorktreeWrite> {
  return Effect.flatMap(WorktreeWrite, (lease) =>
    Effect.andThen(
      Effect.sync(() => lease.assertWrite(worktreeId)),
      Effect.suspend(() => work(() => lease.confirmCommit(worktreeId))),
    ),
  );
}
