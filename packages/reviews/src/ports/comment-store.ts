import type {
  CommentAppend,
  CommentMessage,
  CommentResolution,
  CommentStorage,
  CommentThread,
  CommentUsage,
  PostedCommentMessage,
} from '../models/comment-thread.ts';

export interface CommentStore {
  list(worktreeId: string): CommentThread[];
  find(threadId: string): CommentThread | undefined;
  findMessage(messageId: string): PostedCommentMessage | undefined;
  usage(worktreeId: string): CommentUsage;
  lastRevision(): number;
  lastRevisionIn(worktreeId: string): number;
  insert(thread: CommentThread, storage: CommentStorage): void;
  append(
    worktreeId: string,
    threadId: string,
    message: CommentMessage,
    change: CommentAppend,
  ): void;
  resolve(threadId: string, change: CommentResolution): void;
}
