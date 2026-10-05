import type { Effect } from 'effect';
import { Context } from 'effect';
import { type WorktreeKey, type WorktreeKeys } from '@porcelain/kernel/models';
import {
  type CommentSeenMark,
  type CommentSeenUpdate,
} from '../models/comment-thread.ts';

export interface CommentSeenStore {
  seenThrough(input: WorktreeKey): Effect.Effect<number>;
  seenByWorktrees(input: WorktreeKeys): Effect.Effect<CommentSeenMark[]>;
  save(input: CommentSeenUpdate): Effect.Effect<void>;
}

export const CommentSeenStore = Context.Service<
  '@porcelain/reviews/CommentSeenStore',
  CommentSeenStore
>('@porcelain/reviews/CommentSeenStore');
