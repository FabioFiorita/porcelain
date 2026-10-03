import { InstallerError } from './installer-error.ts';

export class InvalidServiceConfigurationError extends InstallerError {
  override readonly name = 'InvalidServiceConfigurationError';
  constructor() {
    super(
      'The saved service configuration is invalid. Uninstall and install the service again.',
    );
  }
}
