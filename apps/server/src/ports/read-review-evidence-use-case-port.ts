import type {
  ReadReviewEvidenceInput,
  ReviewEvidence,
} from '@porcelain/reviews/models';
import type { OperationContext } from './operation-context.ts';

export interface ReadReviewEvidenceUseCasePort {
  execute(
    input: ReadReviewEvidenceInput,
    context: OperationContext,
  ): Promise<ReviewEvidence>;
}
