import type { ReviewRevision } from './verdict.ts';
import type { ReviewMarks, ReviewStatus } from './review.ts';
export function revisionReviewItems(
  revision: Pick<ReviewRevision, 'files'>,
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

export function revisionDecisionStates(
  revision: { content: Pick<ReviewRevision['content'], 'layers'> },
  marks: ReviewMarks | undefined,
) {
  return new Map(
    revision.content.layers.map((layer) => [
      layer.id,
      {
        stale: false,
        reviewed:
          marks?.decisions.some(
            (mark) =>
              mark.layerId === layer.id &&
              mark.fingerprint === layer.fingerprint,
          ) === true,
      },
    ]),
  );
}
