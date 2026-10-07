import { Schema } from 'effect';

export class InvalidServiceConfigurationError extends Schema.TaggedError<InvalidServiceConfigurationError>()(
  'InvalidServiceConfigurationError',
  {},
) {
  override get message() {
    return 'The saved service configuration is invalid. Uninstall and install the service again.';
  }
}
