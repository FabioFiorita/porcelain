export class UnsupportedHistoryDataError extends Error {
  override readonly name = 'UnsupportedHistoryDataError';
  constructor(cause?: unknown) {
    super('History contains unsupported data', { cause });
  }
}
