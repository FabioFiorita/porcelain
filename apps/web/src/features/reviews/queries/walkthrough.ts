import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readLayerMarks } from '@porcelain/client/reviews';
import {
  currentStop,
  stopDone,
  type WalkthroughStop,
  decisionStates,
  type ReviewLayer,
  type ReviewResponse,
  type ReviewScope,
  walkthroughStops,
} from '@porcelain/client/reviews/rules';
import { useChanges } from '@/features/changes/index';
import { usePreferences } from '@/features/preferences/index';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { useWalkthroughPlace } from '../store';
import { usePublishedReview } from './published-review';
import { usePrefetchReviewed, useReviewChangeItems } from './reviewed';

function useDecisionStates(
  scope: ReviewScope,
  context: ConnectionContext,
  layers: readonly ReviewLayer[],
) {
  const read = readLayerMarks({ scope, connection: context.connection });
  const marks = useAtomValue(read);
  const retry = useAtomRefresh(read);
  const published = usePublishedReview(scope, context);
  return {
    states: decisionStates(
      layers,
      Option.getOrUndefined(AsyncResult.value(marks)),
    ),
    settled:
      AsyncResult.isSuccess(marks) &&
      !marks.waiting &&
      !published.result.waiting,
    failed: AsyncResult.isFailure(marks),
    retry,
  };
}

export function useWalkthrough(
  scope: ReviewScope,
  context: ConnectionContext,
  review: ReviewResponse,
) {
  usePrefetchReviewed(scope, context);
  const { preferences } = usePreferences();
  const list = useChanges(scope, context.connection);
  const items = useReviewChangeItems(scope, context, list);
  const stops = walkthroughStops(
    review,
    list.changes.map((change) => change.path),
    { specsApart: preferences.collapseSpecs },
  );
  const { place, setPlace, view, setView } = useWalkthroughPlace(
    scope.worktreeId,
  );
  const decisions = useDecisionStates(scope, context, review.layers);
  return {
    stops,
    items,
    stop: currentStop(stops, place),
    go: setPlace,
    view,
    setView,
    decisions,
    done: (stop: WalkthroughStop) => stopDone(stop, items, decisions.states),
  };
}
