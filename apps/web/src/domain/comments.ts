import type {
  commentThreadSchema,
  createCommentThreadSchema,
  replyToCommentSchema,
  resolveCommentSchema,
} from '@porcelain/contracts/comments';
export type CommentThread = ReturnType<typeof commentThreadSchema.parse>;
export type NewComment = ReturnType<typeof createCommentThreadSchema.parse>;
export type NewReply = ReturnType<typeof replyToCommentSchema.parse>;
export type CommentResolution = ReturnType<typeof resolveCommentSchema.parse>;
