import type { Worktree } from '@porcelain/kernel/models';
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import { WorktreeNotFoundError } from '../errors/worktree-not-found-error.ts';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import type { CheckWorktreeAccessInput } from '../models/check-worktree-access.ts';

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
    if (check.kind === 'missing') throw new WorktreeNotFoundError();
    if (check.kind === 'unavailable') throw new WorktreeUnavailableError();
    return check.worktree;
  }
}
