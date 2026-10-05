import { Schema } from 'effect';

export class IncompleteDiffReadError extends Schema.TaggedError<IncompleteDiffReadError>()(
  'IncompleteDiffReadError',
  {},
) {
  override get message() {
    return 'Diff read returned fewer results than requested';
  }
}
