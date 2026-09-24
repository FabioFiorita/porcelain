import type { WorktreeAccess } from '@porcelain/kernel/ports';
import { WorktreeNotFoundError } from '../errors/worktree-not-found-error.ts';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import type {
  CheckWorktreeInput,
  CheckWorktreeResult,
} from '../models/check-worktree.ts';

export class CheckWorktreeService {
  private readonly worktreeAccess: WorktreeAccess;

  constructor(worktreeAccess: WorktreeAccess) {
    this.worktreeAccess = worktreeAccess;
  }

  async execute(
    input: CheckWorktreeInput,
    signal?: AbortSignal,
  ): Promise<CheckWorktreeResult> {
    const check =
      input.purpose === 'writing'
        ? await this.worktreeAccess.forWriting(input.worktreeId, signal)
        : await this.worktreeAccess.known(input.worktreeId, signal);
    if (check.kind === 'missing') throw new WorktreeNotFoundError();
    if (check.kind === 'unavailable') throw new WorktreeUnavailableError();
    if (
      input.projectId !== undefined &&
      check.worktree.projectId !== input.projectId
    )
      throw new WorktreeNotFoundError();
    return check.worktree;
  }
}
