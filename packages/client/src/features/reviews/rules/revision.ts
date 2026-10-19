import type { ReviewRevision } from './verdict.ts';
import type { ReviewMarks, ReviewStatus } from './review.ts';
export function revisionReviewItems(
  revision: ReviewRevision,
  marks: ReviewMarks | undefined,
) {
  return revision.files.map((file) => {
    const fingerprint = file.newOid ?? file.oldOid;
    const reviewed =
      marks?.files.some(
        (mark) => mark.path === file.path && mark.fingerprint === fingerprint,
      ) === true;
    const reviewStatus: ReviewStatus = reviewed ? 'reviewed' : 'unreviewed';
    return { path: file.path, fingerprint, reviewStatus };
  });
}
