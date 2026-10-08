import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readLayerMarks } from '@porcelain/client/reviews';
import {
  reviewUnderstanding,
  type ReviewLayer,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useReviewUnderstanding(
  scope: ReviewScope,
  context: ConnectionContext,
  layers: readonly ReviewLayer[],
) {
  const result = useAtomValue(
    readLayerMarks({ scope, connection: context.connection }),
  );
  return {
    ...reviewUnderstanding(
      layers,
      Option.getOrUndefined(AsyncResult.value(result)),
    ),
    pending: result.waiting || AsyncResult.isInitial(result),
    failed: AsyncResult.isFailure(result),
  };
}
