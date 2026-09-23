export class CommentLimitExceededError extends Error {
  override readonly name = 'CommentLimitExceededError';

  constructor() {
    super('Comment capacity exceeded');
  }
}
