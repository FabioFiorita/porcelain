import { Schema } from 'effect';

export class RuntimeSplitEffectError extends Schema.TaggedError<RuntimeSplitEffectError>()(
  'RuntimeSplitEffectError',
  {
    copies: Schema.Array(Schema.String),
  },
) {
  override get message() {
    return `The persistent runtime installed ${this.copies.length} copies of effect, which would split its module state: ${this.copies.join(', ')}`;
  }
}
