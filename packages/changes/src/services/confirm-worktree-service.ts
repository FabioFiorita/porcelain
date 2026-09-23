import type { WorktreeInput } from '../models/operation-inputs.ts';
import type { Worktree } from '../models/worktree.ts';
import type { WorktreeAccess } from '../ports/worktree-access.ts';

export class ConfirmWorktreeService {
  private readonly worktreeAccess: WorktreeAccess;

  constructor(worktreeAccess: WorktreeAccess) {
    this.worktreeAccess = worktreeAccess;
  }

  execute(input: WorktreeInput, signal?: AbortSignal): Promise<Worktree> {
    return this.worktreeAccess.known(input.worktreeId, signal);
  }
}
