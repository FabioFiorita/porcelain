import type { ReviewThreadOrigin } from './comment-thread.ts';
import type {
  CommentAnchor,
  CommentLimits,
  CommentThread,
  CommentWriter,
} from './comment-thread.ts';

export type CreateCommentThreadInput = {
  review?: ReviewThreadOrigin | undefined;
  worktreeId: string;
  threadId?: string | undefined;
  messageId?: string | undefined;
  anchor: CommentAnchor;
  body: string;
  writer: CommentWriter;
};

export type CreateCommentThreadResult = CommentThread;

export type CreateCommentThreadOptions = CommentLimits;
