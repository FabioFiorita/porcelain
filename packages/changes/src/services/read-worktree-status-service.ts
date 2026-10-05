import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type {
  ReadWorktreeStatusInput,
  ReadWorktreeStatusResult,
} from '../models/read-worktree-status.ts';
import type { ChangeStatusReader } from '../ports/change-status-reader.ts';

export class ReadWorktreeStatusService<E = never> {
  private readonly changeStatusReader: ChangeStatusReader<E>;

  constructor(changeStatusReader: ChangeStatusReader<E>) {
    this.changeStatusReader = changeStatusReader;
  }

  execute(
    input: ReadWorktreeStatusInput,
  ): Effect.Effect<ReadWorktreeStatusResult, E, WorktreeRead> {
    return this.changeStatusReader.readStatus(input);
  }
}
