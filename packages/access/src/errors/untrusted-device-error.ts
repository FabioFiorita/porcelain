export class UntrustedDeviceError extends Error {
  override readonly name = 'UntrustedDeviceError';
  constructor() {
    super(
      'An owner must trust this device on the computer that runs Porcelain before it can update Porcelain',
    );
  }
}
