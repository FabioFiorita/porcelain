export class DuplicateLayerIdError extends Error {
  override readonly name = 'DuplicateLayerIdError';

  constructor() {
    super('Layer IDs repeat within the review');
  }
}
