import { Schema } from 'effect';

export class InvalidReviewPointerError extends Schema.TaggedError<InvalidReviewPointerError>()(
  'InvalidReviewPointerError',
  {
    layerId: Schema.String,
    stepId: Schema.String,
    path: Schema.String,
    startLine: Schema.Number,
    endLine: Schema.Number,
    reason: Schema.Literals(['missing', 'unreadable', 'out-of-range']),
    lineCount: Schema.optionalKey(Schema.Number),
  },
) {
  override get message() {
    const pointer = `Step \`${this.stepId}\` in layer \`${this.layerId}\` points to \`${this.path}:${this.startLine}-${this.endLine}\``;
    switch (this.reason) {
      case 'missing':
        return `${pointer}, which does not exist in this worktree`;
      case 'unreadable':
        return `${pointer}, which is not a readable text file`;
      case 'out-of-range':
        return `${pointer}, but the file has ${this.lineCount} lines`;
      default:
        return this.reason satisfies never;
    }
  }
}
