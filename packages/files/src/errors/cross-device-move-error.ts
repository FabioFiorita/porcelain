export class CrossDeviceMoveError extends Error {
  override readonly name = 'CrossDeviceMoveError';

  constructor() {
    super('Destination is on another filesystem; nothing was moved');
  }
}
