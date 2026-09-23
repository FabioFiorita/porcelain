import type {
  CommentAnchor,
  CommentThread,
  CommentWriter,
} from './comment-thread.ts';

export type ListCommentThreadsInput = { worktreeId: string };
export type ListCommentThreadsResult = CommentThread[];

export type CreateCommentThreadInput = {
  worktreeId: string;
  threadId?: string | undefined;
  messageId?: string | undefined;
  anchor: CommentAnchor;
  body: string;
  writer: CommentWriter;
};
export type CreateCommentThreadResult = CommentThread;

export type ReplyToCommentInput = {
  worktreeId: string;
  threadId: string;
  messageId?: string | undefined;
  body: string;
  writer: CommentWriter;
};
export type ReplyToCommentResult = CommentThread;

export type ResolveCommentThreadInput = {
  worktreeId: string;
  threadId: string;
  resolved: boolean;
};
export type ResolveCommentThreadResult = CommentThread;

export type MarkCommentsSeenInput = {
  worktreeId: string;
  throughRevision: number;
};
export type MarkCommentsSeenResult = {
  worktreeId: string;
  seenThrough: number;
};
