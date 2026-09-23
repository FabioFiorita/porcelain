export class UnitExistsError extends Error {
  override readonly name = 'UnitExistsError';
  constructor(unitPath: string) {
    super(`Refusing to replace the existing service unit at ${unitPath}.`);
  }
}
