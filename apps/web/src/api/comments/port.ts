import type { CommentThread, NewComment } from '../../domain/comments';
import type { ReviewRequest } from '../review/port';
export type CommentsPort = {
  list: (request: ReviewRequest) => Promise<CommentThread[]>;
  create: (
    request: ReviewRequest & { input: NewComment },
  ) => Promise<CommentThread[]>;
};
