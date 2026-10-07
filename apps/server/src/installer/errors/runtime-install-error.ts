import { Schema } from 'effect';

export class RuntimeInstallError extends Schema.TaggedError<RuntimeInstallError>()(
  'RuntimeInstallError',
  {
    detail: Schema.String,
  },
) {
  override get message() {
    return `Could not install the persistent runtime: ${this.detail}`;
  }
}
