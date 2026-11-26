import { Context, type Effect } from 'effect';
import type {
  DraftCommentKey,
  StoredDraftComment,
} from '../models/draft-comment.ts';

export interface DraftCommentStore {
  list(input: DraftCommentKey): Effect.Effect<readonly StoredDraftComment[]>;
  find(input: {
    worktreeId: string;
    id: string;
  }): Effect.Effect<StoredDraftComment | undefined>;
  insert(comment: StoredDraftComment): Effect.Effect<void>;
  updateText(input: {
    worktreeId: string;
    id: string;
    text: string;
    updatedAt: string;
  }): Effect.Effect<void>;
  remove(input: { worktreeId: string; id: string }): Effect.Effect<void>;
  markPublished(input: {
    worktreeId: string;
    ids: readonly string[];
    url: string;
    publishedAt: string;
  }): Effect.Effect<void>;
}

export const DraftCommentStore = Context.Service<
  '@porcelain/reviews/DraftCommentStore',
  DraftCommentStore
>('@porcelain/reviews/DraftCommentStore');
