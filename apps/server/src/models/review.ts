import type {
  PublishReview,
  ReviewDiagram,
  ReviewResponse,
  ReviewStep,
} from '@porcelain/contracts/review';

export type { PublishReview, ReviewResponse, ReviewStep };

export type StoredReviewStep =
  PublishReview['layers'][number]['steps'][number] & {
    published: string[];
  };
export type StoredReviewLayer = Omit<
  PublishReview['layers'][number],
  'steps'
> & { steps: StoredReviewStep[]; fingerprint: string };
export type StoredReview = {
  worktreeId: string;
  revision: number;
  publishedAt: string;
  active: boolean;
  summaryHtml: string;
  summaryToken: string;
  summarySecret: string;
  diagram?: ReviewDiagram | undefined;
  layers: StoredReviewLayer[];
};
