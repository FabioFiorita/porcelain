export class GitActionReceiptMismatchError extends Error {
  override readonly name = 'GitActionReceiptMismatchError';

  constructor() {
    super('Git action receipt does not match this request');
  }
}
