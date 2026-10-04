import type {
  CreateCommentThreadRequest,
  CreateCommentThreadResponse,
  DeleteCommentMessageResponse,
  DeleteResolvedCommentsRequest,
  DeleteResolvedCommentsResponse,
  EditCommentMessageRequest,
  ReplyToCommentRequest,
  UpdateCommentThreadRequest,
} from '@porcelain/contracts/reviews';
export type CommentThread = CreateCommentThreadResponse;
export type NewComment = CreateCommentThreadRequest;
type NewReply = ReplyToCommentRequest;
type CommentResolution = UpdateCommentThreadRequest;

export type ReplyCommentInput = { threadId: string } & NewReply;
export type ResolveCommentInput = { threadId: string } & CommentResolution;
export type EditCommentInput = {
  threadId: string;
  messageId: string;
} & EditCommentMessageRequest;
export type DeleteCommentInput = { threadId: string; messageId: string };
export type ConfirmedThreads = DeleteResolvedCommentsRequest['threads'];

type CommentRequest = {
  projectId?: string;
  worktreeId: string;
  signal: AbortSignal;
};
export type CommentsPort = {
  list: (request: CommentRequest) => Promise<CommentThread[]>;
  create: (
    request: CommentRequest & { input: NewComment },
  ) => Promise<CommentThread[]>;
  reply: (
    request: CommentRequest & { threadId: string; input: NewReply },
  ) => Promise<CommentThread[]>;
  resolve: (
    request: CommentRequest & { threadId: string; input: CommentResolution },
  ) => Promise<CommentThread[]>;
  edit: (
    request: CommentRequest & EditCommentInput,
  ) => Promise<CommentThread[]>;
  remove: (
    request: CommentRequest & DeleteCommentInput,
  ) => Promise<DeleteCommentMessageResponse>;
  removeResolved: (
    request: CommentRequest & DeleteResolvedCommentsRequest,
  ) => Promise<DeleteResolvedCommentsResponse>;
  seen: (
    request: CommentRequest & { throughRevision: number },
  ) => Promise<{ worktreeId: string; seenThrough: number }>;
};
