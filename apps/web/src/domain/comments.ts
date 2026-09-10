import type {
  commentThreadSchema,
  createCommentThreadSchema,
} from '@porcelain/contracts/comments';
export type CommentThread = ReturnType<typeof commentThreadSchema.parse>;
export type NewComment = ReturnType<typeof createCommentThreadSchema.parse>;
