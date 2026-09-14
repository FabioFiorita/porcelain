import type {
  commentThreadSchema,
  createCommentThreadSchema,
  replyToCommentSchema,
  resolveCommentSchema,
} from '@porcelain/contracts/comments';
export type CommentThread = ReturnType<typeof commentThreadSchema.parse>;
export type CommentAnchor = CommentThread['anchor'];
export type CommentMessage = CommentThread['messages'][number];
export type CommentAuthor = CommentMessage['author'];
export type NewComment = ReturnType<typeof createCommentThreadSchema.parse>;
export type NewReply = ReturnType<typeof replyToCommentSchema.parse>;
export type CommentResolution = ReturnType<typeof resolveCommentSchema.parse>;
