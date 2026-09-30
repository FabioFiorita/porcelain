export class DeviceNotFoundError extends Error {
  override readonly name = 'DeviceNotFoundError';
  constructor() {
    super('Device not found');
  }
}
