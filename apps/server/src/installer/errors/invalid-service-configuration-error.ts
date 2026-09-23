export class InvalidServiceConfigurationError extends Error {
  override readonly name = 'InvalidServiceConfigurationError';
  constructor() {
    super(
      'The saved service configuration is invalid. Uninstall and install the service again.',
    );
  }
}
