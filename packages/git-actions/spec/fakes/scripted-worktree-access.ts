import type { Worktree, WorktreeCheck } from '@porcelain/git-actions/models';
import type { WorktreeAccess } from '@porcelain/git-actions/ports';

export class ScriptedWorktreeAccess implements WorktreeAccess {
  private readonly worktrees = new Map<
    string,
    { worktree: Worktree; writable: boolean }
  >();
  private readonly unlisted = new Set<string>();

  present(worktree: Worktree, options: { writable: boolean }): void {
    this.worktrees.set(worktree.id, { worktree, writable: options.writable });
  }

  unreadable(worktreeId: string): void {
    this.unlisted.add(worktreeId);
  }

  async known(worktreeId: string): Promise<WorktreeCheck> {
    if (this.unlisted.has(worktreeId)) return { outcome: 'unavailable' };
    const entry = this.worktrees.get(worktreeId);
    return entry
      ? { outcome: 'found', worktree: { ...entry.worktree } }
      : { outcome: 'missing' };
  }

  async forWriting(worktreeId: string): Promise<WorktreeCheck> {
    const check = await this.known(worktreeId);
    if (check.outcome !== 'found') return check;
    return this.worktrees.get(worktreeId)?.writable
      ? check
      : { outcome: 'unavailable' };
  }
}
