import { Context, Effect } from 'effect';
import { nativeOperation } from './native-operation.ts';

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

export function nativeRead<A>(
  worktreeId: string,
  work: (signal: AbortSignal) => Promise<A>,
): Effect.Effect<A, never, WorktreeRead> {
  return Effect.flatMap(WorktreeRead, (lease) =>
    nativeOperation((signal) => {
      lease.assert(worktreeId);
      return work(signal);
    }),
  );
}

export function nativeWrite<A>(
  worktreeId: string,
  work: (signal: AbortSignal, committed: () => void) => Promise<A>,
): Effect.Effect<A, never, WorktreeWrite> {
  return Effect.flatMap(WorktreeWrite, (lease) =>
    nativeOperation((signal) => {
      lease.assertWrite(worktreeId);
      return work(signal, () => lease.confirmCommit(worktreeId));
    }),
  );
}
