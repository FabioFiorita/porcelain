import { WorktreeNotFoundError } from '../errors/worktree-not-found-error.ts';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import type { CheckWorktreeInput } from '../models/git-action-operations.ts';
import type { Worktree } from '../models/worktree.ts';
import type { WorktreeAccess } from '../ports/worktree-access.ts';

export class CheckWorktreeService {
  private readonly worktreeAccess: WorktreeAccess;

  constructor(worktreeAccess: WorktreeAccess) {
    this.worktreeAccess = worktreeAccess;
  }

  async execute(
    input: CheckWorktreeInput,
    signal?: AbortSignal,
  ): Promise<Worktree> {
    const check = await this.worktreeAccess.known(input.worktreeId, signal);
    if (check.outcome === 'missing') throw new WorktreeNotFoundError();
    if (check.outcome === 'unavailable') throw new WorktreeUnavailableError();
    if (check.worktree.projectId !== input.projectId)
      throw new WorktreeNotFoundError();
    return check.worktree;
  }
}
