export class ProviderNotInstalledError extends Error {
  override readonly name = 'ProviderNotInstalledError';

  constructor() {
    super('The selected coding CLI is not installed.');
  }
}
