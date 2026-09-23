import type { CheckWorktreeInput } from '../models/git-action-operations.ts';
import type { Worktree } from '../models/worktree.ts';
import type { WorktreeAccess } from '../ports/worktree-access.ts';

export class CheckWorktreeService {
  private readonly worktreeAccess: WorktreeAccess;

  constructor(worktreeAccess: WorktreeAccess) {
    this.worktreeAccess = worktreeAccess;
  }

  execute(input: CheckWorktreeInput, signal?: AbortSignal): Promise<Worktree> {
    return this.worktreeAccess.known(input.worktreeId, signal);
  }
}
