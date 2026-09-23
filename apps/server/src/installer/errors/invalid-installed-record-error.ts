export class InvalidInstalledRecordError extends Error {
  override readonly name = 'InvalidInstalledRecordError';
  constructor() {
    super(
      'The installed service record is invalid. Preserve the service directory for manual recovery.',
    );
  }
}
