import { WorktreeNotFoundError } from '../errors/worktree-not-found-error.ts';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import type { CheckWorktreeAccessInput, Worktree } from '../models/worktree.ts';
import type { WorktreeAccess } from '../ports/worktree-access.ts';

export class CheckWorktreeAccessService {
  private readonly worktreeAccess: WorktreeAccess;

  constructor(worktreeAccess: WorktreeAccess) {
    this.worktreeAccess = worktreeAccess;
  }

  async execute(
    input: CheckWorktreeAccessInput,
    signal?: AbortSignal,
  ): Promise<Worktree> {
    const check =
      input.intent === 'write'
        ? await this.worktreeAccess.forWriting(input.worktreeId, signal)
        : await this.worktreeAccess.known(input.worktreeId, signal);
    if (check.outcome === 'missing') throw new WorktreeNotFoundError();
    if (check.outcome === 'unavailable') throw new WorktreeUnavailableError();
    return check.worktree;
  }
}
