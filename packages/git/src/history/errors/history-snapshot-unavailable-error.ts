export class HistorySnapshotUnavailableError extends Error {
  override readonly name = 'HistorySnapshotUnavailableError';
  constructor(cause?: unknown) {
    super('History snapshot is unavailable', { cause });
  }
}
