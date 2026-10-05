import { Schema } from 'effect';

export class SelectionMismatchError extends Schema.TaggedError<SelectionMismatchError>()(
  'SelectionMismatchError',
  {},
) {
  override get message() {
    return 'Selections must cover exactly the expected files';
  }
}
