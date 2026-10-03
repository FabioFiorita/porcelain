export class CommentAuthorMismatchError extends Error {
  override readonly name = 'CommentAuthorMismatchError';

  constructor() {
    super('Only the author of a comment may change it');
  }
}
