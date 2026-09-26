export class CommentIdentityConflictError extends Error {
  override readonly name = 'CommentIdentityConflictError';

  constructor() {
    super('Comment ID belongs to a different write');
  }
}
