export class InvalidHistoryRequestError extends Error {
  override readonly name = 'InvalidHistoryRequestError';
  constructor(cause?: unknown) {
    super('Invalid history request', { cause });
  }
}
