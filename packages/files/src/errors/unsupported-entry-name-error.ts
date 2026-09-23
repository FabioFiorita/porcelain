export class UnsupportedEntryNameError extends Error {
  override readonly name = 'UnsupportedEntryNameError';

  constructor() {
    super('Directory contains a name that is not supported UTF-8');
  }
}
