import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type {
  ReadBranchDetailsInput,
  ReadBranchDetailsResult,
} from '../models/read-branch-details.ts';
import type { ChangeStatusReader } from '../ports/change-status-reader.ts';

export class ReadBranchDetailsService<E = never> {
  private readonly changeStatusReader: ChangeStatusReader<E>;

  constructor(changeStatusReader: ChangeStatusReader<E>) {
    this.changeStatusReader = changeStatusReader;
  }

  execute(
    input: ReadBranchDetailsInput,
  ): Effect.Effect<ReadBranchDetailsResult, E, WorktreeRead> {
    return this.changeStatusReader.readBranchDetails({
      worktreeId: input.worktreeId,
      branchName: input.branch?.name,
      headOid: input.headOid,
    });
  }
}
