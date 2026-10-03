export class CommentRevisionMismatchError extends Error {
  override readonly name = 'CommentRevisionMismatchError';

  constructor() {
    super('The comparison must identify the revision it belongs to');
  }
}
