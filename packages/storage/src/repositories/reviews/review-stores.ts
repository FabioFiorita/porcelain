import type {
  CommentSeenStore,
  CommentStore,
  ReviewedFileStore,
  ReviewedLayerStore,
  ReviewStore,
} from '@porcelain/reviews/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { SqliteCommentStore } from './sqlite-comment-store.ts';
import { SqliteCommentSeenStore } from './sqlite-comment-seen-store.ts';
import { SqliteReviewedFileStore } from './sqlite-reviewed-file-store.ts';
import { SqliteReviewedLayerStore } from './sqlite-reviewed-layer-store.ts';
import { SqliteReviewStore } from './sqlite-review-store.ts';

export function createCommentStore(session: StorageSession): CommentStore {
  return new SqliteCommentStore(databaseOf(session));
}

export function createCommentSeenStore(
  session: StorageSession,
): CommentSeenStore {
  return new SqliteCommentSeenStore(databaseOf(session));
}

export function createReviewedFileStore(
  session: StorageSession,
): ReviewedFileStore {
  return new SqliteReviewedFileStore(databaseOf(session));
}

export function createReviewedLayerStore(
  session: StorageSession,
): ReviewedLayerStore {
  return new SqliteReviewedLayerStore(databaseOf(session));
}

export function createReviewStore(session: StorageSession): ReviewStore {
  return new SqliteReviewStore(databaseOf(session));
}
