export class DiskFullError extends Error {
  override readonly name = 'DiskFullError';

  constructor() {
    super('There is not enough space on the disk');
  }
}
