export class UnknownArrowBoxError extends Error {
  override readonly name = 'UnknownArrowBoxError';

  constructor() {
    super('A diagram arrow joins a box its diagram does not have');
  }
}
