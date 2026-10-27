import { Schema } from 'effect';

export class ReviewGitSettingsTrustRequiredError extends Schema.TaggedError<ReviewGitSettingsTrustRequiredError>()(
  'ReviewGitSettingsTrustRequiredError',
  {},
) {
  override get message() {
    return 'An owner must trust this device on the computer that runs Porcelain before it can change Reviews & Git settings';
  }
}
