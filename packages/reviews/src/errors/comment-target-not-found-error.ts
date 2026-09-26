export class CommentTargetNotFoundError extends Error {
  override readonly name = 'CommentTargetNotFoundError';

  constructor() {
    super('Comment target not found');
  }
}
