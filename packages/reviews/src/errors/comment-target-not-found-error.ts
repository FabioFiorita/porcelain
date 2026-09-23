export class CommentTargetNotFoundError extends Error {
  constructor() {
    super('Comment target not found');
    this.name = 'CommentTargetNotFoundError';
  }
}
