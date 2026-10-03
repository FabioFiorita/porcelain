export class InvalidDeviceDetailsError extends Error {
  override readonly name = 'InvalidDeviceDetailsError';
  constructor() {
    super(
      'The device name or platform is missing, too long, or contains control characters.',
    );
  }
}
