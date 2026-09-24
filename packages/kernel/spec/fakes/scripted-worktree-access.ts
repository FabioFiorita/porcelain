import type { Worktree, WorktreeCheck } from '../../src/models/worktree.ts';
import type { WorktreeAccess } from '../../src/ports/worktree-access.ts';

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
    if (this.unlisted.has(worktreeId)) return { kind: 'unavailable' };
    const entry = this.worktrees.get(worktreeId);
    return entry
      ? { kind: 'found', worktree: { ...entry.worktree } }
      : { kind: 'missing' };
  }

  async forWriting(worktreeId: string): Promise<WorktreeCheck> {
    const check = await this.known(worktreeId);
    if (check.kind !== 'found') return check;
    return this.worktrees.get(worktreeId)?.writable
      ? check
      : { kind: 'unavailable' };
  }
}
