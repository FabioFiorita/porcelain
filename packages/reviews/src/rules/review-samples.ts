import { sha256Hex } from '@porcelain/kernel/rules';
import type { Review } from '../models/review.ts';
import type { ReviewSamples } from '../models/review-samples.ts';

export function reviewSamples(
  review: Pick<Review, 'layers' | 'diagram' | 'files'>,
  entropy: string,
): ReviewSamples {
  const candidates = review.layers.flatMap((layer) =>
    layer.steps.map((step) => {
      const path = step.pointer.path;
      const question = review.diagram?.after.boxes.some(
        (box) =>
          box.layerId === layer.id &&
          (box.decision || box.problem !== undefined),
      );
      const removal = review.files.some(
        (file) =>
          file.status === 'deleted' &&
          file.path.startsWith(path.slice(0, path.lastIndexOf('/') + 1)),
      );
      const boundary = /(?:^|\/)(?:contracts|rules|architecture)(?:\/|\.)/.test(
        path,
      );
      const weight =
        1 + (question ? 4 : 0) + (removal ? 4 : 0) + (boundary ? 3 : 0);
      const random =
        (parseInt(
          sha256Hex(`${entropy}:${layer.id}:${step.id}`).slice(0, 8),
          16,
        ) +
          1) /
        4294967297;
      return {
        layerId: layer.id,
        stepId: step.id,
        sampled: false,
        rank: -Math.log(random) / weight,
      };
    }),
  );
  return candidates
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 2)
    .map(({ rank: _, ...pick }) => pick);
}
