import { Schema } from 'effect';

export class DiskFullError extends Schema.TaggedError<DiskFullError>()(
  'DiskFullError',
  {},
) {
  override get message() {
    return 'There is not enough space on the disk';
  }
}
