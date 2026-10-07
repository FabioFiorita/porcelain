import { Schema } from 'effect';

export class UpdateRecoveryError extends Schema.TaggedError<UpdateRecoveryError>()(
  'UpdateRecoveryError',
  {
    detail: Schema.String,
  },
) {
  override get message() {
    return `Porcelain update failed and automatic recovery could not finish. The update record, previous runtime, and database backup were retained. ${this.detail}`;
  }
}
