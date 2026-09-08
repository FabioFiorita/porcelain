export class ReadLimitExceededError extends Error {
  override readonly name = 'ReadLimitExceededError';
  constructor(cause?: unknown) {
    super('History read exceeds its limit', { cause });
  }
}
