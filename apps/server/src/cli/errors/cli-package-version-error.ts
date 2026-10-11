import { Schema } from 'effect';

export class CliPackageVersionError extends Schema.TaggedError<CliPackageVersionError>()(
  'CliPackageVersionError',
  { path: Schema.String },
) {
  override get message() {
    return `Porcelain could not read a required package version from ${this.path}. Check the package build.`;
  }
}
