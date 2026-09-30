export class DeviceViewerRequiredError extends Error {
  override readonly name = 'DeviceViewerRequiredError';
  constructor() {
    super('A live ticket is issued to a paired device');
  }
}
