import type { Worktree } from '@porcelain/kernel/models';
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import { WorktreeNotFoundError } from '../errors/worktree-not-found-error.ts';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import type { CheckWorktreeInput } from '../models/check-worktree.ts';

export class CheckWorktreeService {
  private readonly worktreeAccess: WorktreeAccess;

  constructor(worktreeAccess: WorktreeAccess) {
    this.worktreeAccess = worktreeAccess;
  }

  async execute(
    input: CheckWorktreeInput,
    signal?: AbortSignal,
  ): Promise<Worktree> {
    const check =
      input.purpose === 'writing'
        ? await this.worktreeAccess.forWriting(input.worktreeId, signal)
        : await this.worktreeAccess.known(input.worktreeId, signal);
    if (check.kind === 'missing') throw new WorktreeNotFoundError();
    if (check.kind === 'unavailable') throw new WorktreeUnavailableError();
    return check.worktree;
  }
}
