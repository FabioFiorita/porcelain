import { Schema } from 'effect';

export class ServiceDowngradeError extends Schema.TaggedError<ServiceDowngradeError>()(
  'ServiceDowngradeError',
  {
    installed: Schema.String,
    candidate: Schema.String,
  },
) {
  override get message() {
    return `Refusing to replace Porcelain ${this.installed} with older ${this.candidate}. Run again with --allow-downgrade to continue.`;
  }
}
