import { Schema } from 'effect';

export class InvalidReviewPointerError extends Schema.TaggedError<InvalidReviewPointerError>()(
  'InvalidReviewPointerError',
  {
    layerId: Schema.String,
    stepId: Schema.String,
    path: Schema.String,
    startLine: Schema.Number,
    endLine: Schema.Number,
  },
) {
  override get message() {
    return `Step \`${this.stepId}\` in layer \`${this.layerId}\` points to \`${this.path}:${this.startLine}-${this.endLine}\`, which does not exist in this worktree`;
  }
}
