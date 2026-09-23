import { CommitDraftError } from '../errors/commit-draft-error.ts';

export class AdmitCommitDraftService {
  private readonly active = new Set<string>();

  execute(worktreeId: string): { release: () => void } {
    if (this.active.has(worktreeId))
      throw new CommitDraftError(
        'A commit draft is already running for this worktree.',
      );
    this.active.add(worktreeId);
    return { release: () => this.active.delete(worktreeId) };
  }
}
