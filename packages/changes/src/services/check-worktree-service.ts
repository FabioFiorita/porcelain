import type { Worktree } from '@porcelain/kernel/models';
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import { WorktreeNotFoundError } from '../errors/worktree-not-found-error.ts';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import type { WorktreeInput } from '../models/operation-inputs.ts';

export class CheckWorktreeService {
  private readonly worktreeAccess: WorktreeAccess;

  constructor(worktreeAccess: WorktreeAccess) {
    this.worktreeAccess = worktreeAccess;
  }

  async execute(input: WorktreeInput, signal?: AbortSignal): Promise<Worktree> {
    const check = await this.worktreeAccess.known(input.worktreeId, signal);
    if (check.kind === 'missing') throw new WorktreeNotFoundError();
    if (check.kind === 'unavailable') throw new WorktreeUnavailableError();
    return check.worktree;
  }
}
