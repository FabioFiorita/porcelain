export class BoxLaneOutOfRangeError extends Error {
  override readonly name = 'BoxLaneOutOfRangeError';

  constructor() {
    super('A diagram box names a lane its diagram does not have');
  }
}
