export class CommentIdentityConflictError extends Error {
  constructor() {
    super('Comment ID belongs to a different write');
    this.name = 'CommentIdentityConflictError';
  }
}
