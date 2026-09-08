export class WorktreeChangedError extends Error {
  override readonly name = 'WorktreeChangedError';
  constructor() {
    super('Worktree changed during inspection');
  }
}
