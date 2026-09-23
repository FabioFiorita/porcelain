import type {
  CommentStore,
  ReviewedFileStore,
  ReviewedLayerStore,
  ReviewStore,
} from '@porcelain/reviews/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { CommentRepository } from './comment-repository.ts';
import { ReviewedFileRepository } from './reviewed-file-repository.ts';
import { ReviewedLayerRepository } from './reviewed-layer-repository.ts';
import { ReviewRepository } from './review-repository.ts';

export function createCommentStore(session: StorageSession): CommentStore {
  return new CommentRepository(databaseOf(session));
}

export function createReviewedFileStore(
  session: StorageSession,
): ReviewedFileStore {
  return new ReviewedFileRepository(databaseOf(session));
}

export function createReviewedLayerStore(
  session: StorageSession,
): ReviewedLayerStore {
  return new ReviewedLayerRepository(databaseOf(session));
}

export function createReviewStore(session: StorageSession): ReviewStore {
  return new ReviewRepository(databaseOf(session));
}
