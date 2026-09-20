export class OwnerSocketUnreadableError extends Error {
  override readonly name = 'OwnerSocketUnreadableError';
  constructor(path: string, reason: string) {
    super(
      `Something is listening on ${path} but ${reason}. ` +
        'Porcelain will not remove a socket it cannot identify; stop whatever ' +
        'owns it, or start with a different data directory.',
    );
  }
}
