import {
  maxReleaseReviewRounds,
  type Review,
  type ReviewedCommit,
  type ReviewState,
} from './review-verdict.ts';

export async function judgeReview(input: {
  head: string;
  lane: 'main' | 'release';
  releaseBase?: string | undefined;
  requested: boolean;
  locallyReviewed: boolean;
  saved: ReviewState | undefined;
  review: (
    previous: ReviewedCommit | undefined,
    releaseRound?: number,
  ) => Promise<Review>;
  decide: () => Promise<boolean>;
}) {
  const previous = input.saved?.reviewed;
  if (input.lane === 'release') {
    const rounds = input.saved?.releaseRound ?? (previous ? 1 : 0);
    if (rounds >= maxReleaseReviewRounds) {
      if (previous?.releaseRound !== maxReleaseReviewRounds)
        throw new Error(
          'The final hosted release review did not return a verdict.',
        );
      return { reviewed: previous, decision: undefined };
    }
    const sameBase = input.saved?.releaseBase === input.releaseBase;
    if (sameBase && previous?.sha === input.head)
      return { reviewed: previous, decision: undefined };
    const releaseRound = rounds + 1;
    return {
      reviewed: {
        sha: input.head,
        releaseRound,
        review: await input.review(
          sameBase ? previous : undefined,
          releaseRound,
        ),
      },
      decision: undefined,
    };
  }

  let reviewed = previous?.sha === input.head ? previous : undefined;
  let decision =
    input.saved?.decision?.sha === input.head
      ? input.saved.decision
      : undefined;
  if (!decision)
    decision = { sha: input.head, needsOwner: await input.decide() };
  if (input.requested) {
    if (!reviewed && !input.locallyReviewed)
      reviewed = { sha: input.head, review: await input.review(previous) };
  } else if (
    !reviewed &&
    !input.locallyReviewed &&
    previous?.review.findings.some((item) => item.priority <= 2)
  ) {
    throw new Error(
      'Earlier review findings need verification. Mark the fixed head reviewed or request a review.',
    );
  }
  return { reviewed, decision };
}
