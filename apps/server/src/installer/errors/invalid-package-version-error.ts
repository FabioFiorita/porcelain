import { Schema } from 'effect';

export class InvalidPackageVersionError extends Schema.TaggedError<InvalidPackageVersionError>()(
  'InvalidPackageVersionError',
  {
    version: Schema.String,
  },
) {
  override get message() {
    return `Invalid package version: ${this.version}`;
  }
}
