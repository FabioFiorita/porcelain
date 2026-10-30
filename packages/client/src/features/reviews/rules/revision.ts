import {
  decisionCodeMoved,
  stopDone,
  walkthroughStops,
} from './walkthrough.ts';
import { decisionMarked } from './review-list.ts';
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
        stale: decisionCodeMoved(layer),
        reviewed: decisionMarked(marks?.decisions, layer),
      },
    ]),
  );
}

export function revisionDecisionProgress(
  revision: {
    files: ReviewRevision['files'];
    content: Pick<ReviewRevision['content'], 'layers' | 'notExplained'>;
  },
  marks: ReviewMarks | undefined,
  options: { specsApart: boolean },
) {
  const items = revisionReviewItems(revision, marks);
  const decisions = revisionDecisionStates(revision, marks);
  const stops = walkthroughStops(
    revision.content,
    revision.files.map((file) => file.path),
    options,
  );
  return {
    reviewed: stops.filter(
      (stop) => stop.kind === 'decision' && stopDone(stop, items, decisions),
    ).length,
    total: revision.content.layers.length,
  };
}
