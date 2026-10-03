export class DuplicateStepIdError extends Error {
  override readonly name = 'DuplicateStepIdError';

  constructor() {
    super('Step IDs repeat within a layer');
  }
}
