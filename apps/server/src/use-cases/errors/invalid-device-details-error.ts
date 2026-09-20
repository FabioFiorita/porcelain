export class InvalidDeviceDetailsError extends Error {
  override readonly name = 'InvalidDeviceDetailsError';
  constructor(field: string) {
    super(
      `The device ${field} is missing, too long, or contains control characters.`,
    );
  }
}
