import { Schema } from 'effect';

export class GitActionReceiptMismatchError extends Schema.TaggedError<GitActionReceiptMismatchError>()(
  'GitActionReceiptMismatchError',
  {},
) {
  override get message() {
    return 'Git action receipt does not match this request';
  }
}
