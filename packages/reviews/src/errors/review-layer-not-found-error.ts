export class ReviewLayerNotFoundError extends Error {
  override readonly name = 'ReviewLayerNotFoundError';

  constructor() {
    super('Review layer not found');
  }
}
