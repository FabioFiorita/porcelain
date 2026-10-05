import { Context } from 'effect';
import { type WorktreeKey, type WorktreeKeys } from '@porcelain/kernel/models';
import {
  type CommentSeenMark,
  type CommentSeenUpdate,
} from '../models/comment-thread.ts';

export interface CommentSeenStore {
  seenThrough(input: WorktreeKey): number;
  seenByWorktrees(input: WorktreeKeys): CommentSeenMark[];
  save(input: CommentSeenUpdate): void;
}

export const CommentSeenStore = Context.Service<
  '@porcelain/reviews/CommentSeenStore',
  CommentSeenStore
>('@porcelain/reviews/CommentSeenStore');
