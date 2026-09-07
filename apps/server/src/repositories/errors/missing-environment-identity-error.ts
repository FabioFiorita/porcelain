export class MissingEnvironmentIdentityError extends Error {
  override readonly name = 'MissingEnvironmentIdentityError';
  constructor() {
    super('Missing environment identity');
  }
}
