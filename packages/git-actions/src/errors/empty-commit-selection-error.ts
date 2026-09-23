export class EmptyCommitSelectionError extends Error {
  override readonly name = 'EmptyCommitSelectionError';

  constructor() {
    super('Select at least one path to commit');
  }
}
