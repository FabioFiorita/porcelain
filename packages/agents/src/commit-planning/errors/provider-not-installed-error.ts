import { Schema } from 'effect';

export class ProviderNotInstalledError extends Schema.TaggedError<ProviderNotInstalledError>()(
  'ProviderNotInstalledError',
  {},
) {
  override get message() {
    return 'The selected coding CLI is not installed.';
  }
}
