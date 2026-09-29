export class ServiceUpdateRunningError extends Error {
  override readonly name = 'ServiceUpdateRunningError';
  constructor() {
    super('An update is already running');
  }
}
