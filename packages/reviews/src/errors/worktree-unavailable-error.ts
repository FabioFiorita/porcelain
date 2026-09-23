export class WorktreeUnavailableError extends Error {
  override readonly name = 'WorktreeUnavailableError';

  constructor() {
    super('Repository could not be inspected');
  }
}
