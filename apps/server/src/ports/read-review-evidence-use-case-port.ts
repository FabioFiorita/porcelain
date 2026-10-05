import {
  type ReadReviewEvidenceInput,
  type ReviewEvidence,
} from '@porcelain/reviews/models';
import { type Effect, Context } from 'effect';
import { type WorktreeRead } from '@porcelain/effects';
import { type GitIoFailure } from '@porcelain/git/errors';
import { type IncompleteDiffReadError } from '@porcelain/changes/errors';

export interface ReadReviewEvidenceUseCasePort {
  execute(
    input: ReadReviewEvidenceInput,
  ): Effect.Effect<
    ReviewEvidence,
    GitIoFailure | IncompleteDiffReadError,
    WorktreeRead
  >;
}

export const ReadReviewEvidenceUseCasePort = Context.Service<
  '@porcelain/server/ReadReviewEvidenceUseCasePort',
  ReadReviewEvidenceUseCasePort
>('@porcelain/server/ReadReviewEvidenceUseCasePort');
