import { Schema } from 'effect';

export class ReviewGitSettingsNotConfiguredError extends Schema.TaggedError<ReviewGitSettingsNotConfiguredError>()(
  'ReviewGitSettingsNotConfiguredError',
  {},
) {
  override get message() {
    return 'Choose Reviews & Git settings for this computer before changing one of them';
  }
}
