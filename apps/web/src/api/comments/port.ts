import type {
  CommentResolution,
  CommentThread,
  NewComment,
  NewReply,
} from '../../domain/comments';
import type { ReviewRequest } from '../review/port';
export type CommentsPort = {
  list: (request: ReviewRequest) => Promise<CommentThread[]>;
  create: (
    request: ReviewRequest & { input: NewComment },
  ) => Promise<CommentThread[]>;
  reply: (
    request: ReviewRequest & { threadId: string; input: NewReply },
  ) => Promise<CommentThread[]>;
  resolve: (
    request: ReviewRequest & {
      threadId: string;
      input: CommentResolution;
    },
  ) => Promise<CommentThread[]>;
  /**
   * Say how far the discussion has actually been read. Sent when it is on
   * screen, carrying the highest revision displayed — never "everything now",
   * which would swallow a reply that arrived while the page sat open.
   */
  seen: (
    request: ReviewRequest & { throughRevision: number },
  ) => Promise<{ worktreeId: string; seenThrough: number }>;
};
