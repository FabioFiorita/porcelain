export class ServiceNotManagedError extends Error {
  override readonly name = 'ServiceNotManagedError';
  constructor() {
    super(
      'Porcelain is not running as the installed service, so it cannot update itself',
    );
  }
}
