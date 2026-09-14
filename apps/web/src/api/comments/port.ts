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
};
