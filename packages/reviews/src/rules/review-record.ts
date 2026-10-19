import { reviewPullRequestNumber } from './review-publication.ts';
import type {
  Review,
  ReviewRecord,
  BranchReviewKey,
} from '../models/review.ts';

export function reviewRecordView({
  commonDirectory: _,
  ...record
}: ReviewRecord) {
  return record;
}
export function revisionMetadata(review: Review) {
  return {
    reviewId: review.reviewId,
    projectId: review.projectId,
    revision: review.revision,
    headOid: review.headOid,
    base: review.base,
    baseOid: review.baseOid,
    mergeBaseOid: review.mergeBaseOid,
    publishedAt: review.publishedAt,
    branch: review.branch,
    worktreePath: review.worktreePath,
    worktreeName: review.worktreeName,
  };
}

export function openReviewForKey(
  records: readonly ReviewRecord[],
  input: BranchReviewKey,
): ReviewRecord | undefined {
  const open = records.filter(
    (record) => record.state === 'open' && record.projectId === input.projectId,
  );
  return input.pullRequest === undefined
    ? open.find((record) => record.branch === input.branch)
    : (open.find(
        (record) =>
          reviewPullRequestNumber(record.pullRequest) ===
          reviewPullRequestNumber(input.pullRequest),
      ) ??
        open.find(
          (record) =>
            record.branch === input.branch && record.pullRequest === undefined,
        ));
}
