export class UnsupportedGitFiltersError extends Error {
  override readonly name = 'UnsupportedGitFiltersError';

  constructor() {
    super('Git conversion filters are unsupported for worktree inspection');
  }
}
