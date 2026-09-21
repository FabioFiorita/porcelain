import type {
  CommentMessage,
  CommentThread,
  StoredCommentThread,
} from '../../models/comment-thread.ts';
export interface CommentStore {
  list(worktreeId: string): StoredCommentThread[];
  find(worktreeId: string, threadId: string): StoredCommentThread | undefined;
  usage(worktreeId: string): { threads: number; bytes: number };
  create(thread: CommentThread): StoredCommentThread;
  reply(
    worktreeId: string,
    threadId: string,
    message: CommentMessage,
  ): StoredCommentThread | undefined;
  resolve(
    worktreeId: string,
    threadId: string,
    resolved: boolean,
  ): StoredCommentThread | undefined;
}
