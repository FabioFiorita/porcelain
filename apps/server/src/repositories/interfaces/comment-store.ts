import type { CommentThread } from '../../models/comment-thread.ts';
export interface CommentStore {
  list(worktreeId: string): CommentThread[];
  save(thread: CommentThread): void;
}
