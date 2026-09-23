export class UnrecognizedUnitError extends Error {
  override readonly name = 'UnrecognizedUnitError';
  constructor(unitPath: string) {
    super(`Refusing to remove an unrecognized service unit at ${unitPath}.`);
  }
}
