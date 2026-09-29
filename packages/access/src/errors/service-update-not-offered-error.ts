export class ServiceUpdateNotOfferedError extends Error {
  override readonly name = 'ServiceUpdateNotOfferedError';
  constructor() {
    super('That version is not the newer version this server offers');
  }
}
