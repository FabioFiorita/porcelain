export class InvalidCommentError extends Error {
  override readonly name = 'InvalidCommentError';

  constructor() {
    super('Invalid comment');
  }
}
