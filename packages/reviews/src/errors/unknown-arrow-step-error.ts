export class UnknownArrowStepError extends Error {
  override readonly name = 'UnknownArrowStepError';

  constructor() {
    super('A layer arrow joins a step its layer does not have');
  }
}
