export class UnnamedDiffSelectionError extends Error {
  override readonly name = 'UnnamedDiffSelectionError';

  constructor() {
    super('A diff selection names neither an old nor a new path');
  }
}
