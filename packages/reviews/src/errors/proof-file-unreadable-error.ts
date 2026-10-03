export class ProofFileUnreadableError extends Error {
  override readonly name = 'ProofFileUnreadableError';

  constructor() {
    super(
      'A proof file is missing from the worktree or is not a readable file',
    );
  }
}
