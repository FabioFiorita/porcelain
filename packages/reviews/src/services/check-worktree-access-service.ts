import type { CheckWorktreeAccessInput, Worktree } from '../models/worktree.ts';
import type { WorktreeAccess } from '../ports/worktree-access.ts';

export class CheckWorktreeAccessService {
  private readonly worktreeAccess: WorktreeAccess;

  constructor(worktreeAccess: WorktreeAccess) {
    this.worktreeAccess = worktreeAccess;
  }

  execute(
    input: CheckWorktreeAccessInput,
    signal?: AbortSignal,
  ): Promise<Worktree> {
    return input.intent === 'write'
      ? this.worktreeAccess.forWriting(input.worktreeId, signal)
      : this.worktreeAccess.known(input.worktreeId, signal);
  }
}
