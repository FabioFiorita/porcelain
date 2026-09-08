export class CommentLimitExceededError extends Error {
  constructor() {
    super('Comment capacity exceeded');
    this.name = 'CommentLimitExceededError';
  }
}
