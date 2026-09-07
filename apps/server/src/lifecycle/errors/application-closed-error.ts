export class ApplicationClosedError extends Error {
  override readonly name = 'ApplicationClosedError';
  constructor() {
    super('Application is closing or closed');
  }
}
