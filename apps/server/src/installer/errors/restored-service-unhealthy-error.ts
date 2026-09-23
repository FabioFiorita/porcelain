export class RestoredServiceUnhealthyError extends Error {
  override readonly name = 'RestoredServiceUnhealthyError';
  constructor() {
    super(
      'The previous service was restored after an interrupted update but did not become healthy.',
    );
  }
}
