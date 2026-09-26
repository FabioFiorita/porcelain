export class MissingEnvironmentIdentityError extends Error {
  override readonly name = 'MissingEnvironmentIdentityError';
  constructor() {
    super('This server has no environment identity.');
  }
}
