export class UnsupportedCommentComparisonError extends Error {
  override readonly name = 'UnsupportedCommentComparisonError';

  constructor() {
    super('A comment on the whole change compares only against a branch');
  }
}
