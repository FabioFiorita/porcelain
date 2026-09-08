import type { CommentThread } from '../../models/comment-thread.ts';
export interface CommentStore {
  list(worktreeId: string): CommentThread[];
  find(worktreeId: string, threadId: string): CommentThread | undefined;
  usage(worktreeId: string): { threads: number; bytes: number };
  save(thread: CommentThread): void;
}
