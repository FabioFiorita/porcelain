import type {
  CommentThread,
  StoredCommentThread,
} from '../../models/comment-thread.ts';
export interface CommentStore {
  list(worktreeId: string): StoredCommentThread[];
  find(worktreeId: string, threadId: string): StoredCommentThread | undefined;
  usage(worktreeId: string): { threads: number; bytes: number };
  /** Returns the thread with the revision this write was given. */
  save(thread: CommentThread): StoredCommentThread;
}
