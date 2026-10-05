import type {
  ReadReviewEvidenceInput,
  ReviewEvidence,
} from '@porcelain/reviews/models';
import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects';
import type { GitIoFailure } from './git-io-failure.ts';
import type { IncompleteDiffReadError } from '@porcelain/changes/errors';

export interface ReadReviewEvidenceUseCasePort {
  execute(
    input: ReadReviewEvidenceInput,
  ): Effect.Effect<
    ReviewEvidence,
    GitIoFailure | IncompleteDiffReadError,
    WorktreeRead
  >;
}
