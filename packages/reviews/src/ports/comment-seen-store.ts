import type { WorktreeKey, WorktreeKeys } from '@porcelain/kernel/models';
import type {
  CommentSeenMark,
  CommentSeenUpdate,
} from '../models/comment-thread.ts';

export interface CommentSeenStore {
  seenThrough(input: WorktreeKey): number;
  seenByWorktrees(input: WorktreeKeys): CommentSeenMark[];
  save(input: CommentSeenUpdate): void;
}
