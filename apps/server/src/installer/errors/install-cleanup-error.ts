import { Schema } from 'effect';

export class InstallCleanupError extends Schema.TaggedError<InstallCleanupError>()(
  'InstallCleanupError',
  {
    detail: Schema.String,
  },
) {
  override get message() {
    return `Porcelain installation failed and the service could not be stopped safely. The runtime and backup were retained. ${this.detail}`;
  }
}
