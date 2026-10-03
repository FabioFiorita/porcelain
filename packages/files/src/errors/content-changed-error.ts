export class ContentChangedError extends Error {
  override readonly name = 'ContentChangedError';

  constructor() {
    super('Content changed; retry the operation');
  }
}
