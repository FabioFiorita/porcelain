export class TrashUnavailableError extends Error {
  override readonly name = 'TrashUnavailableError';

  constructor() {
    super('This machine has no trash; nothing was deleted');
  }
}
