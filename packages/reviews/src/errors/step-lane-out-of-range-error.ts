export class StepLaneOutOfRangeError extends Error {
  override readonly name = 'StepLaneOutOfRangeError';

  constructor() {
    super('A step names a lane its layer does not have');
  }
}
