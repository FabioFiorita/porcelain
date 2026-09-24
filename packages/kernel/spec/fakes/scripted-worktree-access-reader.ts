import type { Worktree, WorktreeCheck } from '../../src/models/worktree.ts';
import type { WorktreeAccessReader } from '../../src/ports/worktree-access-reader.ts';

export class ScriptedWorktreeAccessReader implements WorktreeAccessReader {
  private readonly readable = new Map<string, WorktreeCheck>();
  private readonly writable = new Map<string, WorktreeCheck>();

  present(worktree: Worktree, options: { writable: boolean }): void {
    const found: WorktreeCheck = { kind: 'found', worktree };
    this.readable.set(worktree.id, found);
    this.writable.set(
      worktree.id,
      options.writable ? found : { kind: 'unavailable' },
    );
  }

  unreadable(worktreeId: string): void {
    this.readable.set(worktreeId, { kind: 'unavailable' });
    this.writable.set(worktreeId, { kind: 'unavailable' });
  }

  async known(input: { worktreeId: string }): Promise<WorktreeCheck> {
    return this.readable.get(input.worktreeId) ?? { kind: 'missing' };
  }

  async forWriting(input: { worktreeId: string }): Promise<WorktreeCheck> {
    return this.writable.get(input.worktreeId) ?? { kind: 'missing' };
  }
}
