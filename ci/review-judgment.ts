import type { Review, ReviewedCommit, ReviewState } from './review-verdict.ts';

export async function judgeReview(input: {
  head: string;
  lane: 'main' | 'release';
  requested: boolean;
  locallyReviewed: boolean;
  saved: ReviewState | undefined;
  review: (previous: ReviewedCommit | undefined) => Promise<Review>;
  decide: () => Promise<boolean>;
}) {
  const previous = input.saved?.reviewed;
  let review = previous?.sha === input.head ? previous.review : undefined;
  let decision =
    input.saved?.decision?.sha === input.head
      ? input.saved.decision
      : undefined;
  if (input.lane === 'main' && !decision)
    decision = { sha: input.head, needsOwner: await input.decide() };
  if (input.lane === 'release' || input.requested) {
    if (!review && (input.lane === 'release' || !input.locallyReviewed))
      review = await input.review(previous);
  } else if (
    !review &&
    !input.locallyReviewed &&
    previous?.review.findings.some((item) => item.priority <= 2)
  ) {
    throw new Error(
      'Earlier review findings need verification. Mark the fixed head reviewed or request a review.',
    );
  }
  return { review, decision };
}
