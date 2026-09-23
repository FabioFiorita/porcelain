export class InvalidCommentError extends Error {
  constructor() {
    super('Invalid comment');
    this.name = 'InvalidCommentError';
  }
}
