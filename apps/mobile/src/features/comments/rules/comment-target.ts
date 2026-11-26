import * as Schema from 'effect/Schema';
import { addCommentRequestSchema } from '@porcelain/contracts/comments';
import type { CommentAnchor } from '@porcelain/client/comments/rules';

const workspace = Schema.String.check(Schema.isMinLength(1));

export const commentTargetSchema = Schema.Union([
  Schema.Struct({
    workspace,
    anchor: Schema.fromJsonString(addCommentRequestSchema.fields.anchor),
  }),
  Schema.Struct({
    workspace,
    commentId: Schema.String.check(Schema.isMinLength(1)),
  }),
]);

export function newCommentParams(workspaceKey: string, anchor: CommentAnchor) {
  return { workspace: workspaceKey, anchor: JSON.stringify(anchor) };
}

export function editCommentParams(workspaceKey: string, commentId: string) {
  return { workspace: workspaceKey, commentId };
}
