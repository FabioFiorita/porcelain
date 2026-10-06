import { readPublishedReview, readLayerMarks } from '@porcelain/client/reviews';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import type { ReviewLayer, ReviewScope } from '@porcelain/client/reviews/rules';
import { layerReviewState } from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

const focusedReview = Atom.family(
  (input: Parameters<typeof readPublishedReview>[0]) =>
    readPublishedReview(input).pipe(
      Atom.refreshOnWindowFocus,
      Atom.setIdleTTL(0),
    ),
);

export function usePublishedReview(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const atom = focusedReview({ scope, connection: context.connection });
  const result = useAtomValue(atom);
  return {
    result,
    review: Option.getOrUndefined(AsyncResult.value(result)),
    refresh: useAtomRefresh(atom),
  };
}

export function useHasReviewLayers(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return usePublishedReview(scope, context).review?.active ?? false;
}

export function useLayerMark(
  scope: ReviewScope,
  context: ConnectionContext,
  layer: Pick<ReviewLayer, 'id' | 'fingerprint'>,
) {
  const published = usePublishedReview(scope, context);
  const marks = useAtomValue(
    readLayerMarks({ scope, connection: context.connection }),
  );
  return {
    ...layerReviewState(Option.getOrUndefined(AsyncResult.value(marks)), layer),
    settled:
      AsyncResult.isSuccess(marks) &&
      !marks.waiting &&
      !published.result.waiting,
    failed: AsyncResult.isFailure(marks),
  };
}
